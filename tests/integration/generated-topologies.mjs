import { initializeSupabaseSchema } from './supabase-fixture.mjs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createBrightwebClientApp } from '../../packages/create-bw-app/src/generator.mjs';

// Applies exactly the numbered migrations a customer receives. Reordering module
// sources here would hide generator defects, which this gate must catch.
export async function checkGeneratedTopologies({ cluster, check, root }) {
  for (const modules of ['none', 'projects']) {
    await check(`fresh generated ${modules} topology migrates and operates without CRM`, async () => {
      const directory = await mkdtemp(path.join(tmpdir(), 'bw-topology-'));
      const database = `topology_${randomUUID().replaceAll('-', '')}`;
      let client;
      try {
        await createBrightwebClientApp({ name: `topology-${modules}`, template: 'platform', modules, install: false, yes: true }, { targetDir: path.join(directory, 'app'), workspaceRoot: root, dependencyMode: 'published' });
        await cluster.createDatabase(database);
        client = cluster.getPgClient(database);
        await client.connect();
        await client.query("SET statement_timeout = '15s'");
        await initializeSupabaseSchema(client);
        const migrations = path.join(directory, 'app/supabase/migrations');
        for (const file of (await readdir(migrations)).filter(file => file.endsWith('.sql')).sort()) {
          try { await client.query(await readFile(path.join(migrations, file), 'utf8')); }
          catch (error) { throw new Error(`Generated ${modules} migration ${file}: ${error.message}`, { cause: error }); }
        }
        assert.equal((await client.query("SELECT to_regclass('public.crm_contacts') AS table_name")).rows[0].table_name, null);
        const user = randomUUID();
        await client.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())', [user, `${user}@example.invalid`]);
        const profile = (await client.query('SELECT id FROM public.profiles WHERE user_id=$1', [user])).rows[0];
        assert(profile, 'Generated auth trigger creates a profile');
        await client.query("INSERT INTO user_role_assignments(profile_id,role_code) VALUES($1,'admin') ON CONFLICT(profile_id) DO UPDATE SET role_code='admin'", [profile.id]);
        if (modules === 'projects') {
          const organization = randomUUID();
          await client.query("INSERT INTO organizations(id,name) VALUES($1,'Minimal generated organization')", [organization]);
          await client.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [user]);
          await client.query('SET ROLE authenticated');
          const created = await client.query('SELECT * FROM create_project_with_client_access($1,$2,$3,$4,$5)', [randomUUID(), { name: 'Minimal generated project', primary_organization_id: organization }, [organization], '[]', '{"mode":"hidden"}']);
          assert.equal(created.rows[0].created, true);
          assert.equal((await client.query('SELECT name FROM projects WHERE id=$1', [created.rows[0].project_id])).rows[0].name, 'Minimal generated project');
        } else {
          assert.equal((await client.query("SELECT to_regclass('public.projects') AS table_name")).rows[0].table_name, null);
        }
      } finally {
        if (client) await client.end();
        await cluster.dropDatabase(database).catch(error => {
          if (error.code !== '3D000') throw error;
        });
        await rm(directory, { recursive: true, force: true });
      }
    });
  }
}
