import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// A disposable real PostgreSQL database exercises policies as authenticated,
// never as its owner. Only Supabase's auth identity primitives are bootstrapped.
const root = fileURLToPath(new URL("../../", import.meta.url));
const container = `bw-admin-rls-${process.pid}`;
const docker = (args, input) => execFileSync("docker", args, { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
const sql = (source) => docker(["exec", "-i", container, "psql", "-h", "127.0.0.1", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt"], source);
const migration = (name) => readFileSync(`${root}supabase/modules/${name}`, "utf8");
const fix = migration("admin/migrations/20260908120000_admin_profile_directory_visibility.sql");
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const asUser = (n, query) => sql(`BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub = '${uid(n)}'; ${query}; ROLLBACK;`);
const directory = `FROM public.user_role_assignments a JOIN public.profiles p ON p.id = a.profile_id`;
const setup = () => sql(`
  DROP SCHEMA public CASCADE; CREATE SCHEMA public;
  DROP SCHEMA IF EXISTS auth CASCADE; CREATE SCHEMA auth;
  CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_user::text $$;
  GRANT USAGE ON SCHEMA public, auth TO authenticated, anon, service_role;
  ${migration("core/migrations/20260316090000_core_v1.sql")}
  ${migration("admin/migrations/20260316091000_admin_v1.sql")}
  GRANT SELECT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
  GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
`);
const seed = () => sql(`
  INSERT INTO auth.users VALUES
    ('${uid(1)}', 'admin-one@example.test', '{"first_name":"Alex"}'),
    ('${uid(2)}', 'admin-two@example.test', '{"first_name":"Alex"}'),
    ('${uid(3)}', 'staff@example.test', '{"first_name":"Sam"}'),
    ('${uid(4)}', 'client-one@example.test', '{"first_name":"Casey"}'),
    ('${uid(5)}', 'client-two@example.test', '{"first_name":"Casey"}');
  UPDATE public.user_role_assignments SET role_code = CASE
    WHEN profile_id IN (SELECT id FROM public.profiles WHERE user_id IN ('${uid(1)}', '${uid(2)}')) THEN 'admin'
    WHEN profile_id = (SELECT id FROM public.profiles WHERE user_id = '${uid(3)}') THEN 'staff'
    ELSE 'client' END;
`);
function verify() {
  for (const actor of [1, 2]) {
    assert.equal(asUser(actor, `SELECT count(*) ${directory}`), "5", "both administrators see the complete joined directory");
    assert.equal(asUser(actor, `SELECT count(*) ${directory} WHERE p.first_name ILIKE '%casey%'`), "2", "search counts include other people's profiles");
    assert.equal(asUser(actor, `SELECT count(*) ${directory} WHERE a.role_code='client'`), "2", "role filtering counts clients");
    const pages = [0, 2, 4].flatMap(offset => asUser(actor, `SELECT p.email ${directory} ORDER BY p.email LIMIT 2 OFFSET ${offset}`).split("\n"));
    assert.equal(pages.length, 5);
    assert.equal(new Set(pages).size, 5, "pagination neither hides nor repeats users");
    assert.equal(asUser(actor, `SELECT p.email ${directory} WHERE p.first_name ILIKE '%casey%' ORDER BY p.email LIMIT 1 OFFSET 1`), "client-two@example.test");
    assert.equal(asUser(actor, `WITH changed AS (UPDATE public.profiles SET first_name='Forbidden' WHERE user_id='${uid(4)}' RETURNING id) SELECT count(*) FROM changed`), "0", "directory read permission must not grant profile writes");
  }
  for (const actor of [3, 4, 5]) {
    assert.equal(asUser(actor, "SELECT count(*) FROM public.profiles"), "1", "staff/client profile privacy is preserved");
    assert.equal(asUser(actor, `SELECT count(*) ${directory}`), "1");
    assert.equal(asUser(actor, `SELECT count(*) FROM public.profiles WHERE user_id='${uid(1)}'`), "0");
  }
  assert.equal(sql("BEGIN; SET LOCAL ROLE anon; SELECT count(*) FROM public.profiles; ROLLBACK;"), "0", "anonymous users cannot read profiles");
}
try {
  docker(["run", "--detach", "--rm", "--name", container, "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:17-alpine"]);
  docker(["exec", container, "sh", "-c", "attempt=0; until pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; do attempt=$((attempt+1)); [ $attempt -lt 300 ] || exit 1; sleep 0.1; done"]);
  sql("CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;");
  setup(); seed();
  assert.equal(asUser(1, `SELECT count(*) ${directory}`), "1", "historical migrations reproduce the self-only bug");
  sql(fix); verify();
  sql(fix); verify();
  sql(`UPDATE public.user_role_assignments SET role_code='client' WHERE profile_id=(SELECT id FROM public.profiles WHERE user_id='${uid(2)}');`);
  assert.equal(asUser(2, `SELECT count(*) ${directory}`), "1", "revoking admin immediately removes directory access");
  sql(`UPDATE public.user_role_assignments SET role_code='admin' WHERE profile_id=(SELECT id FROM public.profiles WHERE user_id='${uid(2)}');`);
  verify();
  console.log("PASS upgrade: reproduces self-only before fix; directory, privacy, and repeat application pass after fix");
  setup(); seed();
  sql(`CREATE POLICY "Admins can view profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_admin());`);
  sql(fix); verify();
  assert.equal(sql(`SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Admins can view profiles'`), "1", "existing BeGreen policy is replaced without duplication");
  assert.equal(sql(`SELECT count(*) FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND qual LIKE '%is_admin%'`), "1", "only one admin visibility policy remains");
  console.log("PASS existing BeGreen policy: preserves access without duplicate policy");
  setup(); sql(fix); seed(); verify();
  console.log("PASS clean installation: directory, search, counts, pagination, and denied access");
} finally {
  docker(["rm", "--force", container]);
}
