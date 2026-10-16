import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { initializeSupabaseSchema } from './supabase-fixture.mjs';

// No live URL is accepted. Failed application must preserve the old task path,
// including when the caller applies SQL outside a surrounding transaction.
export async function checkClientTaskMigrationPrerequisites({ cluster, check, root }) {
  const database = `client_task_prereq_${randomUUID().replaceAll('-', '')}`;
  await cluster.createDatabase(database);
  const db = cluster.getPgClient(database);
  await db.connect();
  try {
    await db.query("SET statement_timeout='15s'");
    await initializeSupabaseSchema(db);
    const history = [], identity = [], relationships = [], feature = [];
    for (const module of ['core', 'admin', 'orgs', 'projects']) {
      const folder = path.join(root, 'packages/create-bw-app/template/supabase/modules', module, 'migrations');
      for (const file of (await readdir(folder)).filter(file => file.endsWith('.sql')).sort()) {
        const entry = { file, sql: await readFile(path.join(folder, file), 'utf8') };
        if (file.includes('_client_task_collaboration.sql')) feature.push(entry);
        else if (file.includes('_enforce_task_milestone_project.sql')) relationships.push(entry);
        else if (file.startsWith('20261014183138')) identity.push(entry);
        else history.push(entry);
      }
    }
    assert.equal(feature.length, 1); assert.equal(relationships.length, 1); assert.equal(identity.length, 3);
    for (const entry of history.sort((a, b) => a.file.split('_')[0].localeCompare(b.file.split('_')[0]))) await db.query(entry.sql);
    const organization = randomUUID(), project = randomUUID(), task = randomUUID();
    await db.query("INSERT INTO organizations(id,name) VALUES($1,'Client-task prerequisite control')", [organization]);
    await db.query("INSERT INTO projects(id,organization_id,name) VALUES($1,$2,'Existing internal project')", [project, organization]);
    await db.query("INSERT INTO project_tasks(id,project_id,title,description) VALUES($1,$2,'Existing private title','Existing private notes')", [task, project]);
    const state = async () => ({
      columns: (await db.query("SELECT attname,atttypid::text FROM pg_attribute WHERE attrelid='project_tasks'::regclass AND attnum>0 AND NOT attisdropped ORDER BY attnum")).rows,
      guards: (await db.query("SELECT tgname,tgenabled,tgfoid::text FROM pg_trigger WHERE tgrelid IN ('project_tasks'::regclass,'profiles'::regclass) ORDER BY tgrelid,tgname")).rows,
      taskGuard: (await db.query("SELECT pg_get_functiondef('public.enforce_project_task_assignee_and_contributor_update()'::regprocedure) AS definition")).rows,
      executorMemberships: (await db.query("SELECT roleid::text,member::text,admin_option,inherit_option,set_option FROM pg_auth_members WHERE roleid=(SELECT oid FROM pg_roles WHERE rolname='bw_projects_task_executor') ORDER BY member")).rows,
      privateSchema: (await db.query("SELECT nspname,nspacl::text FROM pg_namespace WHERE nspname IN ('bw_projects_private','public') ORDER BY nspname")).rows,
      taskPermissions: (await db.query("SELECT relacl::text FROM pg_class WHERE oid='project_tasks'::regclass")).rows,
      taskPolicies: (await db.query("SELECT polname,polroles::text,polqual::text,polwithcheck::text FROM pg_policy WHERE polrelid='project_tasks'::regclass ORDER BY polname")).rows,
      rows: (await db.query('SELECT id,project_id,title,description,status FROM project_tasks WHERE id=$1', [task])).rows,
    });
    const refused = async () => {
      const before = await state();
      await assert.rejects(db.query(feature[0].sql), error => error.code === '55000' && /PROJECTS_MIGRATION_REQUIRED/.test(error.message));
      assert.deepEqual(await state(), before, 'failed feature prerequisite changes no task/identity guard, row, schema or executor membership');
      assert.equal((await db.query("UPDATE project_tasks SET status='in_progress' WHERE id=$1 RETURNING status", [task])).rows[0].status, 'in_progress');
      assert.equal((await db.query("SELECT to_regprocedure('public.manage_project_client_task(uuid,uuid,uuid,integer,text,jsonb)') AS function")).rows[0].function, null);
    };
    await check('client-task SQL refuses missing identity repair atomically and retains existing internal work', refused);
    for (const entry of identity) await db.query(entry.sql);
    await check('client-task SQL refuses missing same-project relationship repair without weakening identity/task guards', refused);
    await db.query(relationships[0].sql);
    const user = randomUUID();
    await db.query("INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())", [user, `${user}@example.invalid`]);
    const browser = cluster.getPgClient(database);
    await browser.connect();
    try {
      await browser.query("SET ROLE authenticated");
      await browser.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)", [user]);
      const privateRows = async () => (await browser.query('SELECT id,title,description FROM project_tasks WHERE id=$1', [task])).rows;
      assert.deepEqual(await privateRows(), [], 'ordinary client cannot read the unrelated existing task');
      if (!(await db.query("SELECT 1 FROM pg_roles WHERE rolname='bw_projects_task_executor'")).rowCount) {
        await db.query('CREATE ROLE bw_projects_task_executor NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS');
      }
      const createdAuthenticator = !(await db.query("SELECT 1 FROM pg_roles WHERE rolname='authenticator'")).rowCount;
      if (createdAuthenticator) await db.query('CREATE ROLE authenticator NOLOGIN');
      try {
        const cases = ['anon', 'authenticated', 'service_role', 'authenticator'].flatMap(role => [
          { role, kind: 'direct membership', indirect: false, inherit: true, set: true },
          { role, kind: 'indirect inherited membership', indirect: true, inherit: true, set: false },
          { role, kind: 'indirect SET-only membership', indirect: true, inherit: false, set: true },
        ]);
        cases.push({ role: 'authenticated', kind: 'indirect membership without current INHERIT or SET privileges', indirect: true, inherit: false, set: false });
        for (const scenario of cases) {
          await check(`client-task SQL refuses ${scenario.role} ${scenario.kind} atomically`, async () => {
            const group = `client_task_group_${randomUUID().replaceAll('-', '')}`;
            const member = scenario.indirect ? group : scenario.role;
            if (scenario.indirect) await db.query(`CREATE ROLE ${group} NOLOGIN`);
            try {
              await db.query(`GRANT bw_projects_task_executor TO ${member} WITH INHERIT ${scenario.inherit}, SET ${scenario.set}`);
              if (scenario.indirect) await db.query(`GRANT ${group} TO ${scenario.role} WITH INHERIT ${scenario.inherit}, SET ${scenario.set}`);
              const reachable = (await db.query("SELECT pg_has_role($1,'bw_projects_task_executor','USAGE') AS inherited,pg_has_role($1,'bw_projects_task_executor','SET') AS assumable", [scenario.role])).rows[0];
              assert.deepEqual(reachable, { inherited: scenario.inherit, assumable: scenario.set }, 'exercise the actual effective role topology');
              const before = await state();
              assert.deepEqual(await privateRows(), []);
              await assert.rejects(db.query(feature[0].sql), error => error.code === '55000' && /executor must not be granted to API roles/.test(error.message));
              assert.deepEqual(await state(), before, 'refusal preserves columns, guards, data, role grants, table ACLs and policies');
              assert.deepEqual(await privateRows(), [], 'same ordinary session retains no private-task visibility');
            } finally {
              if (scenario.indirect) await db.query(`REVOKE ${group} FROM ${scenario.role}`);
              await db.query(`REVOKE bw_projects_task_executor FROM ${member}`);
              if (scenario.indirect) await db.query(`DROP ROLE ${group}`);
            }
          });
        }
      } finally {
        if (createdAuthenticator) await db.query('DROP ROLE authenticator');
      }
    } finally { await browser.end(); }
    await check('client-task SQL retry after exact prerequisites succeeds and keeps existing rows internal/private', async () => {
      await db.query(feature[0].sql);
      await db.query('SELECT public.assert_profile_auth_identity_v1()');
      assert.deepEqual((await db.query('SELECT task_kind,client_publication,title,description,status FROM project_tasks WHERE id=$1', [task])).rows,
        [{ task_kind: 'internal', client_publication: 'draft', title: 'Existing private title', description: 'Existing private notes', status: 'in_progress' }]);
      assert.equal((await db.query("UPDATE project_tasks SET status='done' WHERE id=$1 RETURNING status", [task])).rows[0].status, 'done');
    });
  } finally { await db.end(); }
}
