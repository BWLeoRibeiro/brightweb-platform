import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { initializeSupabaseSchema } from './supabase-fixture.mjs';

const boundary = '20261014183138';
const functionSignatures = [
  'public.guard_privileged_profile_fields()',
  'public.accept_admin_user_invitation(uuid,uuid,text)',
  'public.bootstrap_first_admin(uuid,text)',
  'public.assign_organization_member_atomic(uuid,uuid,text,text,uuid)',
  'public.accept_organization_invitation(uuid,uuid,text)',
];

// Fresh synthetic DB only. Each rejected application rolls back to its fixture,
// allowing persisted old behavior and definitions to be compared with controls.
export async function checkIdentityMigrationPrerequisites({ cluster, check, root }) {
  const database = `identity_prereq_${randomUUID().replaceAll('-', '')}`;
  await cluster.createDatabase(database);
  const db = cluster.getPgClient(database);
  await db.connect();
  try {
    await db.query("SET statement_timeout='15s'");
    await initializeSupabaseSchema(db);
    const migrations = [], identity = {};
    for (const module of ['core', 'admin', 'orgs']) {
      const folder = path.join(root, 'packages/create-bw-app/template/supabase/modules', module, 'migrations');
      for (const file of (await readdir(folder)).filter(file => file.endsWith('.sql')).sort()) {
        const sql = await readFile(path.join(folder, file), 'utf8');
        if (file.startsWith(boundary)) identity[module] = sql;
        else migrations.push({ file, sql });
      }
    }
    for (const { sql } of migrations.sort((a, b) => a.file.split('_')[0].localeCompare(b.file.split('_')[0]))) await db.query(sql);
    const userId = randomUUID(), email = `${userId}@example.invalid`, organizationId = randomUUID();
    await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())', [userId, email]);
    const profileId = (await db.query('SELECT id FROM profiles WHERE user_id=$1', [userId])).rows[0].id;
    await db.query("UPDATE user_role_assignments SET role_code='staff' WHERE profile_id=$1", [profileId]);
    await db.query("INSERT INTO organizations(id,name) VALUES($1,'Identity prerequisite fixture')", [organizationId]);
    const invitations = { admin: randomUUID(), orgs: randomUUID() };
    await db.query("INSERT INTO admin_user_invitations(id,invited_email,role_code,status,expires_at) VALUES($1,$2,'staff','pending',now()+interval '1 day')", [invitations.admin, email]);
    await db.query("INSERT INTO organization_invitations(id,organization_id,invited_email,role,status,expires_at) VALUES($1,$2,$3,'member','pending',now()+interval '1 day')", [invitations.orgs, organizationId, email]);
    const definitions = async () => (await db.query('SELECT pg_get_functiondef(to_regprocedure(signature)) AS definition FROM unnest($1::text[]) signature', [functionSignatures])).rows;
    const original = await definitions();
    const browserDenial = async () => {
      await db.query('SAVEPOINT browser_write');
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)", [userId]);
      await db.query('SET LOCAL ROLE authenticated');
      const allowed = await db.query("UPDATE profiles SET first_name='Allowed account edit' WHERE id=$1", [profileId]);
      assert.equal(allowed.rowCount, 1, 'table grants and own-profile RLS permit the positive control');
      await assert.rejects(db.query("UPDATE profiles SET email='forged@example.invalid' WHERE id=$1", [profileId]), error => error.code === '42501');
      await db.query('ROLLBACK TO browser_write');
      assert.equal((await db.query('SELECT email FROM profiles WHERE id=$1', [profileId])).rows[0].email, email);
    };
    const oldAcceptanceControl = async module => {
      await db.query('SAVEPOINT old_acceptance');
      await db.query('SET LOCAL ROLE service_role');
      const rpc = module === 'admin' ? 'accept_admin_user_invitation' : 'accept_organization_invitation';
      const result = await db.query(`SELECT public.${rpc}($1,$2,$3) AS result`, [invitations[module], profileId, email]);
      assert.equal(result.rows[0].result.status, 'accepted', 'old function remains operational');
      await db.query('ROLLBACK TO old_acceptance');
    };
    const guardState = async () => (await db.query("SELECT tgname,tgenabled,tgtype,tgfoid::text FROM pg_trigger WHERE tgrelid='profiles'::regclass ORDER BY tgname")).rows;
    const failedApply = async (module, sql = identity[module]) => {
      const before = await definitions(), guardsBefore = await guardState();
      await db.query('SAVEPOINT failed_apply');
      await assert.rejects(db.query(sql), error => error.code === '55000' && /IDENTITY_MIGRATION_REQUIRED/.test(error.message));
      await db.query('ROLLBACK TO failed_apply');
      assert.deepEqual(await definitions(), before, 'failed dependency leaves pre-application module definitions untouched');
      assert.deepEqual(await guardState(), guardsBefore, 'failed dependency preserves the installed guard state');
      if (guardsBefore.some(guard => ['guard_privileged_profile_fields','guard_profile_identity_update'].includes(guard.tgname) && ['O','A'].includes(guard.tgenabled) && guard.tgtype === 19)) await browserDenial();
      await oldAcceptanceControl(module);
    };
    const scenarios = [
      ['absent Core', async () => {}],
      ['cutoff excludes Core identity boundary', async () => {
        assert(migrations.every(({ file }) => file.split('_')[0] < boundary), 'historical applied catalog is held below boundary');
      }],
      ['failed Core DDL', async () => {
        const invalid = identity.core.replace('$identity_ddl$;', "SELECT identity_synthetic_missing_function();\n$identity_ddl$;");
        await db.query('SAVEPOINT failed_core');
        await assert.rejects(db.query(invalid), error => error.code === '42883');
        await db.query('ROLLBACK TO failed_core');
        assert.equal((await db.query("SELECT to_regprocedure('public.assert_profile_auth_identity_v1()') ready")).rows[0].ready, null);
      }],
      ['truncated Core statement', async () => {
        await db.query('SAVEPOINT truncated_core');
        await assert.rejects(db.query(identity.core.slice(0, Math.floor(identity.core.length / 2))), error => error.code === '42601');
        await db.query('ROLLBACK TO truncated_core');
      }],
      ['incomplete Core with no final assertion', async () => {
        await db.query(identity.core);
        await db.query('DROP FUNCTION public.assert_profile_auth_identity_v1()');
      }],
      ['disabled Core INSERT guard', async () => {
        await db.query(identity.core);
        await db.query('ALTER TABLE profiles DISABLE TRIGGER guard_profile_identity_insert');
      }],
      ['disabled Core UPDATE guard', async () => {
        await db.query(identity.core);
        await db.query('ALTER TABLE profiles DISABLE TRIGGER guard_profile_identity_update');
      }],
      ['wrong event Core guard', async () => {
        await db.query(identity.core);
        await db.query('CREATE OR REPLACE TRIGGER guard_profile_identity_update BEFORE INSERT ON profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_identity_update()');
      }],
      ['missing Core helper', async () => {
        await db.query(identity.core);
        await db.query('DROP FUNCTION public.lock_confirmed_profile_auth_identity(uuid,text)');
      }],
      ['browser-accessible Core helper', async () => {
        await db.query(identity.core);
        await db.query('GRANT EXECUTE ON FUNCTION public.resolve_auth_identity(text) TO authenticated');
      }],
      ['unsafe Core helper search path', async () => {
        await db.query(identity.core);
        await db.query('ALTER FUNCTION public.resolve_auth_identity(text) SET search_path=public');
      }],
      ['modified Core helper implementation', async () => {
        await db.query(identity.core);
        await db.query("CREATE OR REPLACE FUNCTION public.resolve_auth_identity(p_email text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN RETURN NULL; END $$");
      }],
    ];
    for (const module of ['admin', 'orgs']) {
      for (const [name, prepare] of scenarios) await check(`${module} identity SQL rejects ${name} and preserves pre-application functions/guards`, async () => {
        await db.query('BEGIN');
        try { await prepare(); await failedApply(module); }
        finally { await db.query('ROLLBACK'); }
      });
      await check(`${module} partial DDL rolls back old functions and guard even if caller continues`, async () => {
        await db.query('BEGIN');
        try {
          await db.query(identity.core);
          const before = await definitions(), guardsBefore = await guardState();
          const invalid = identity[module].replace('$identity_ddl$;', "SELECT identity_synthetic_missing_function();\n$identity_ddl$;");
          await db.query('SAVEPOINT partial_module');
          await assert.rejects(db.query(invalid), error => error.code === '42883');
          await db.query('ROLLBACK TO partial_module');
          assert.deepEqual(await definitions(), before);
          assert.deepEqual(await guardState(), guardsBefore);
          await browserDenial();
          await oldAcceptanceControl(module);
          // Valid retry and reapplication remain within the caller transaction.
          await db.query(identity[module]);
          await db.query(identity[module]);
          await db.query(`SELECT public.assert_${module}_auth_identity_v1()`);
          await browserDenial();
          await oldAcceptanceControl(module);
          await db.query("UPDATE organizations SET name='caller transaction sentinel' WHERE id=$1", [organizationId]);
        } finally { await db.query('ROLLBACK'); }
        assert.deepEqual(await definitions(), original);
        assert.equal((await db.query('SELECT name FROM organizations WHERE id=$1', [organizationId])).rows[0].name, 'Identity prerequisite fixture');
      });
    }
    for (const scopedOrgs of [false, true]) await check(`Core${scopedOrgs ? '+Orgs-only' : '-only'} upgrade permits trusted Auth sync with retained staff claims`, async () => {
      await db.query('BEGIN');
      try {
        await db.query(identity.core);
        if (scopedOrgs) await db.query(identity.orgs);
        await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claims','{\"role\":\"authenticated\"}',true)", [userId]);
        const nextEmail = `${userId}-changed@example.invalid`;
        await db.query('UPDATE auth.users SET email=$2 WHERE id=$1', [userId, nextEmail]);
        assert.equal((await db.query('SELECT email FROM profiles WHERE id=$1', [profileId])).rows[0].email, nextEmail);
        await db.query('UPDATE auth.users SET email=$2 WHERE id=$1', [userId, email]);
        await browserDenial();
      } finally { await db.query('ROLLBACK'); }
    });
    await check('Core plus Admin-only and Orgs-only valid retries install each boundary exactly once', async () => {
      await db.query('BEGIN');
      try {
        await db.query(identity.core);
        await db.query(identity.core);
        for (const module of ['admin', 'orgs']) {
          await db.query(identity[module]);
          await db.query(`SELECT public.assert_${module}_auth_identity_v1()`);
        }
        assert.equal((await db.query("SELECT count(*)::int n FROM pg_trigger WHERE tgrelid='profiles'::regclass AND tgname IN ('guard_profile_identity_insert','guard_profile_identity_update')")).rows[0].n, 2);
        assert.equal((await db.query("SELECT count(*)::int n FROM pg_trigger WHERE tgrelid='profiles'::regclass AND tgname='guard_privileged_profile_fields'")).rows[0].n, 0);
        await browserDenial();
      } finally { await db.query('ROLLBACK'); }
    });
  } finally {
    await db.end();
    await cluster.dropDatabase(database);
  }
}
