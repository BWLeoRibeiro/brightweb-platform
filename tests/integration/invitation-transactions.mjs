import { checkClientTasks } from "./client-task-checks.mjs";
import { checkClientTaskMigrationPrerequisites } from "./client-task-prerequisite-checks.mjs";
import { checkProfileIdentity, checkMembershipIdentity, checkProjectInheritance } from "./identity-checks.mjs";
import { checkIdentityMigrationPrerequisites } from "./identity-prerequisite-checks.mjs";
import { checkProjectsRelationships } from "./projects-relationship-checks.mjs";
import { initializeSupabaseSchema } from "./supabase-fixture.mjs";
import { checkGeneratedTopologies } from "./generated-topologies.mjs";
// Runs only a fresh, package-locked PostgreSQL 17 cluster. Never accepts a
// database URL or existing data directory, so CI and local runs cannot touch clients.
import assert from "node:assert/strict";
import { checkWorkflowTransactions } from "./workflow-checks.mjs";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { checkProjects } from "./project-checks.mjs";
import { createServer } from "node:net";
import { randomUUID } from "node:crypto";
const listener = createServer();
await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve));
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
const directory = await mkdtemp(path.join(tmpdir(), "bw-invitation-sql-"));
const cluster = new EmbeddedPostgres({
  databaseDir: path.join(directory, "db"),
  user: "postgres",
  password: randomUUID(),
  port,
  persistent: false,
  postgresFlags: ["-h", "127.0.0.1"],
  onLog() {},
  onError() {},
});
const root = path.resolve(import.meta.dirname, "../..");
const connections = [];
async function connect(role) {
  const c = cluster.getPgClient();
  await c.connect();
  connections.push(c);
  await c.query(
    "SET statement_timeout = '15s'; SET idle_in_transaction_session_timeout = '30s'",
  );
  if (role) {
    await c.query(`SET ROLE ${role}`);
    await c.query("SELECT set_config('request.jwt.claim.role', $1, false), set_config('request.jwt.claims', $2, false)", [role, JSON.stringify({ role })]);
  }
  return c;
}
let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`PASS ${name}`);
}
try {
  await cluster.initialise();
  await cluster.start();
  const db = await connect();
  assert.equal(
    Math.floor(
      Number(
        (await db.query("SHOW server_version_num")).rows[0].server_version_num,
      ) / 10000,
    ),
    17,
    "integration baseline must match production PostgreSQL 17",
  );
  await db.query('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
  await initializeSupabaseSchema(db);
  // Load the real distributable module history, including new mirrored migrations.
  const migrations = [];
  for (const module of ["core", "admin", "orgs"]) {
    const folder = path.join(
      root,
      "packages/create-bw-app/template/supabase/modules",
      module,
      "migrations",
    );
    for (const file of (await readdir(folder)).filter((f) =>
      f.endsWith(".sql"),
    ))
      migrations.push({ file, folder });
  }
  // Preserve Core/Admin/Orgs dependency order when authored timestamps tie.
  for (const { file, folder } of migrations.sort((a, b) =>
    a.file.split("_")[0].localeCompare(b.file.split("_")[0]),
  )) {
    try {
      await db.query(await readFile(path.join(folder, file), "utf8"));
    } catch (error) {
      throw new Error(`Migration ${file}: ${error.message}`);
    }
  }
  const service = await connect("service_role");
  for (const role of ["anon", "authenticated"])
    await check(`profile identity synchronization denies ${role}`, async () => {
      const id = randomUUID(),
        originalEmail = `${id}@example.invalid`;
      await db.query("INSERT INTO auth.users(id,email) VALUES($1,$2)", [
        id,
        originalEmail,
      ]);
      const caller = await connect(role);
      await assert.rejects(
        caller.query(
          "SELECT public.sync_profile_from_auth_identity($1,'changed@example.invalid','{}')",
          [id],
        ),
        (error) => error.code === "42501",
      );
      assert.equal(
        (
          await db.query("SELECT email FROM public.profiles WHERE user_id=$1", [
            id,
          ])
        ).rows[0].email,
        originalEmail,
      );
    });
  await check(
    "profile sync derives current Auth identity and preserves auth insert/update triggers",
    async () => {
      const id = randomUUID();
      await db.query(
        "INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,'trigger@example.invalid','{\"first_name\":\"Synthetic\"}')",
        [id],
      );
      assert.equal(
        (
          await db.query(
            "SELECT first_name FROM public.profiles WHERE user_id=$1",
            [id],
          )
        ).rows[0].first_name,
        "Synthetic",
      );
      await service.query(
        "SELECT public.sync_profile_from_auth_identity($1,'repaired@example.invalid','{}')",
        [id],
      );
      assert.equal(
        (
          await db.query("SELECT email FROM public.profiles WHERE user_id=$1", [
            id,
          ])
        ).rows[0].email,
        "trigger@example.invalid",
      );
      await db.query(
        "UPDATE auth.users SET email='updated@example.invalid' WHERE id=$1",
        [id],
      );
      assert.equal(
        (
          await db.query("SELECT email FROM public.profiles WHERE user_id=$1", [
            id,
          ])
        ).rows[0].email,
        "updated@example.invalid",
      );
    },
  );

  async function identity({ confirmed = true } = {}) {
    const id = randomUUID(),
      email = `${id}@example.invalid`;
    await db.query("INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,$3)", [
      id,
      email,
      confirmed ? new Date() : null,
    ]);
    const {
      rows: [profile],
    } = await db.query("SELECT id FROM profiles WHERE user_id=$1", [id]);
    return { userId: id, profileId: profile.id, email };
  }
  await check("Auth fixtures retain explicit confirmed and unconfirmed identities", async () => {
    for (const confirmed of [true, false]) {
      const user = await identity({ confirmed });
      const result = await db.query("SELECT email_confirmed_at FROM auth.users WHERE email=$1", [user.email]);
      assert.equal(result.rows[0].email_confirmed_at !== null, confirmed);
    }
  });
  await checkProfileIdentity({ db, service, connect, check, identity });
  const inviter = await identity();
  async function fixture(kind, state = "pending") {
    const user = await identity();
    const id = randomUUID();
    let orgId = null;
    if (kind === "admin")
      await db.query(
        "INSERT INTO admin_user_invitations(id,invited_email,role_code,status,invited_by_profile_id,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '1 day')",
        [id, user.email, "staff", state, inviter.profileId],
      );
    else {
      orgId = randomUUID();
      await db.query("INSERT INTO organizations(id,name) VALUES($1,$2)", [
        orgId,
        "Synthetic organization",
      ]);
      await db.query(
        "INSERT INTO organization_invitations(id,organization_id,invited_email,role,status,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '1 day')",
        [id, orgId, user.email, "member", state],
      );
    }
    return {
      ...user,
      id,
      orgId,
      table:
        kind === "admin"
          ? "admin_user_invitations"
          : "organization_invitations",
      rpc:
        kind === "admin"
          ? "accept_admin_user_invitation"
          : "accept_organization_invitation",
    };
  }
  const accept = (client, f, email = f.email) =>
    client.query(`SELECT public.${f.rpc}($1,$2,$3) AS result`, [
      f.id,
      f.profileId,
      email,
    ]);
  async function state(f) {
    const {
      rows: [row],
    } = await db.query(`SELECT status FROM ${f.table} WHERE id=$1`, [f.id]);
    const {
      rows: [counts],
    } = await db.query(
      f.orgId
        ? "SELECT count(*)::int AS grants FROM organization_members WHERE profile_id=$1"
        : "SELECT count(*)::int AS grants FROM user_role_assignments WHERE profile_id=$1 AND role_code='staff'",
      [f.profileId],
    );
    return { ...row, ...counts };
  }
  // Orgs works without any CRM schema or hook.
  await check("orgs-only acceptance", async () => {
    const f = await fixture("org");
    await accept(service, f);
    assert.deepEqual(await state(f), { status: "accepted", grants: 1 });
  });
  const assign = (client, f, role = "member", email = f.email) =>
    client.query(
      "SELECT public.assign_organization_member_atomic($1,$2,$3,$4,$5) AS result",
      [f.orgId, f.profileId, email, role, inviter.profileId],
    );
  async function memberRole(f) {
    return (
      (
        await db.query(
          "SELECT role FROM organization_members WHERE organization_id=$1 AND profile_id=$2",
          [f.orgId, f.profileId],
        )
      ).rows[0]?.role ?? null
    );
  }
  async function waitForLock(client) {
    for (let i = 0; i < 1000; i++) {
      const result = await db.query(
        "SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1",
        [client.processID],
      );
      if (result.rows[0]?.wait_event_type === "Lock") return;
    }
    assert.fail("concurrent operation must reach a PostgreSQL lock wait");
  }
  await check(
    "orgs-only direct assignment and retry reconcile pending invitation and primary contact",
    async () => {
      const f = await fixture("org");
      assert.equal(
        (await assign(service, f, "admin")).rows[0].result.status,
        "immediate_access",
      );
      assert.deepEqual(await state(f), { status: "accepted", grants: 1 });
      assert.equal(
        (
          await db.query(
            "SELECT primary_contact_id FROM organizations WHERE id=$1",
            [f.orgId],
          )
        ).rows[0].primary_contact_id,
        f.profileId,
      );
      assert.equal(
        (await assign(service, f, "admin")).rows[0].result.status,
        "already_member",
      );
      assert.equal(
        (await assign(service, f)).rows[0].result.status,
        "membership_updated",
      );
      assert.equal(
        (
          await db.query(
            "SELECT primary_contact_id FROM organizations WHERE id=$1",
            [f.orgId],
          )
        ).rows[0].primary_contact_id,
        null,
      );
    },
  );
  for (const role of ["anon", "authenticated"])
    await check(`direct assignment denies ${role}`, async () => {
      const f = await fixture("org"),
        client = await connect(role);
      await assert.rejects(
        assign(client, f),
        (error) => error.code === "42501",
      );
      assert.deepEqual(await state(f), { status: "pending", grants: 0 });
    });
  await check(
    "direct assignment rejects wrong identity and invalid roles without writes",
    async () => {
      const f = await fixture("org");
      await assert.rejects(assign(service, f, "owner"), /inválida/);
      await assert.rejects(
        assign(service, f, "member", "other@example.invalid"),
        /corresponde/,
      );
      assert.deepEqual(await state(f), { status: "pending", grants: 0 });
    },
  );
  const crmFolder = path.join(
    root,
    "packages/create-bw-app/template/supabase/modules/crm/migrations",
  );
  for (const file of (await readdir(crmFolder))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    try {
      await db.query(await readFile(path.join(crmFolder, file), "utf8"));
    } catch (error) {
      throw new Error(`Migration ${file}: ${error.message}`);
    }
  }
  await check(
    "direct assignment stock CRM linking commits and retries without duplicates",
    async () => {
      const f = await fixture("org");
      await assign(service, f);
      await assign(service, f);
      const contact = (
        await db.query("SELECT id FROM crm_contacts WHERE profile_id=$1", [
          f.profileId,
        ])
      ).rows;
      assert.equal(contact.length, 1);
      assert.equal(
        (
          await db.query(
            "SELECT accepted_contact_id FROM organization_invitations WHERE id=$1",
            [f.id],
          )
        ).rows[0].accepted_contact_id,
        contact[0].id,
      );
    },
  );
  await check(
    "direct assignment final reconciliation failure rolls back membership CRM and primary contact",
    async () => {
      const f = await fixture("org");
      await db.query(`CREATE FUNCTION reject_direct_reconciliation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id='${f.id}'::uuid THEN RAISE EXCEPTION 'synthetic reconciliation failure'; END IF; RETURN NEW; END; $$;
      CREATE TRIGGER direct_reconciliation_failure BEFORE UPDATE ON organization_invitations FOR EACH ROW EXECUTE FUNCTION reject_direct_reconciliation();`);
      try {
        await assert.rejects(
          assign(service, f, "admin"),
          /synthetic reconciliation failure/,
        );
        assert.deepEqual(await state(f), { status: "pending", grants: 0 });
        assert.equal(
          (
            await db.query(
              "SELECT primary_contact_id FROM organizations WHERE id=$1",
              [f.orgId],
            )
          ).rows[0].primary_contact_id,
          null,
        );
        assert.equal(
          (
            await db.query(
              "SELECT count(*)::int n FROM crm_contacts WHERE profile_id=$1",
              [f.profileId],
            )
          ).rows[0].n,
          0,
        );
      } finally {
        await db.query(
          "DROP TRIGGER direct_reconciliation_failure ON organization_invitations; DROP FUNCTION reject_direct_reconciliation();",
        );
      }
    },
  );
  await check(
    "direct assignment custom hook failure rolls back new and existing membership changes",
    async () => {
      await db.query(`CREATE FUNCTION public.client_organization_invitation_contact_hook(uuid,uuid) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'synthetic contact failure'; END; $$;
      REVOKE ALL ON FUNCTION public.client_organization_invitation_contact_hook(uuid,uuid) FROM PUBLIC,anon,authenticated;
      GRANT EXECUTE ON FUNCTION public.client_organization_invitation_contact_hook(uuid,uuid) TO service_role;`);
      try {
        const fresh = await fixture("org");
        await assert.rejects(
          assign(service, fresh),
          (error) => error.code === "BW001",
        );
        assert.deepEqual(await state(fresh), { status: "pending", grants: 0 });
        // A second connection holds an uncommitted concurrent grant. The RPC must
        // wait, see that grant, and leave it intact when its own integration fails.
        for (const initiallyPresent of [false, true]) {
          const f = await fixture("org"),
            writer = await connect(),
            caller = await connect("service_role");
          if (initiallyPresent)
            await db.query(
              "INSERT INTO organization_members(organization_id,profile_id,role) VALUES($1,$2,'member')",
              [f.orgId, f.profileId],
            );
          await writer.query("BEGIN");
          await writer.query(
            "INSERT INTO organization_members(organization_id,profile_id,role) VALUES($1,$2,'admin') ON CONFLICT(organization_id,profile_id) DO UPDATE SET role='admin'",
            [f.orgId, f.profileId],
          );
          const pending = assign(caller, f).then(
            () => null,
            (error) => error,
          );
          await waitForLock(caller);
          await writer.query("COMMIT");
          assert.equal((await pending).code, "BW001");
          assert.equal(await memberRole(f), "admin");
          assert.deepEqual(await state(f), { status: "pending", grants: 1 });
        }
        await db.query(
          `CREATE OR REPLACE FUNCTION public.client_organization_invitation_contact_hook(uuid,uuid) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN RETURN NULL; END; $$;`,
        );
        const f = await fixture("org");
        await assign(service, f);
        assert.equal(
          (
            await db.query(
              "SELECT count(*)::int n FROM crm_contacts WHERE profile_id=$1",
              [f.profileId],
            )
          ).rows[0].n,
          0,
        );
      } finally {
        await db.query(
          "DROP FUNCTION public.client_organization_invitation_contact_hook(uuid,uuid)",
        );
      }
    },
  );
  await check(
    "concurrent direct assignment retries resolve current membership exactly once",
    async () => {
      const f = await fixture("org"),
        first = await connect("service_role"),
        second = await connect("service_role");
      await first.query("BEGIN");
      assert.equal(
        (await assign(first, f)).rows[0].result.status,
        "immediate_access",
      );
      const pending = assign(second, f);
      await waitForLock(second);
      await first.query("COMMIT");
      assert.equal((await pending).rows[0].result.status, "already_member");
      assert.equal(await memberRole(f), "member");
    },
  );
  for (const directFirst of [true, false])
    await check(
      `direct assignment and acceptance serialize with ${directFirst ? "assignment" : "acceptance"} first`,
      async () => {
        const f = await fixture("org"),
          first = await connect("service_role"),
          second = await connect("service_role");
        await first.query("BEGIN");
        if (directFirst) await assign(first, f, "admin");
        else await accept(first, f);
        const pending = directFirst
          ? accept(second, f)
          : assign(second, f, "admin");
        await waitForLock(second);
        await first.query("COMMIT");
        await pending;
        assert.equal(await memberRole(f), "admin");
        assert.deepEqual(await state(f), { status: "accepted", grants: 1 });
      },
    );
  await check(
    "client-owned contact hook participates in rollback and replaces stock linking",
    async () => {
      const f = await fixture("org");
      await db.query(
        "CREATE FUNCTION public.client_organization_invitation_contact_hook(uuid,uuid) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'synthetic custom hook failure'; END; $$; REVOKE ALL ON FUNCTION public.client_organization_invitation_contact_hook(uuid,uuid) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.client_organization_invitation_contact_hook(uuid,uuid) TO service_role;",
      );
      try {
        await assert.rejects(
          accept(service, f),
          /synthetic custom hook failure/,
        );
        assert.deepEqual(await state(f), { status: "pending", grants: 0 });
        await db.query(
          "CREATE OR REPLACE FUNCTION public.client_organization_invitation_contact_hook(uuid,uuid) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN RETURN NULL; END; $$;",
        );
        await accept(service, f);
        assert.deepEqual(await state(f), { status: "accepted", grants: 1 });
        assert.equal(
          (
            await db.query(
              "SELECT count(*)::int n FROM crm_contacts WHERE profile_id=$1",
              [f.profileId],
            )
          ).rows[0].n,
          0,
        );
      } finally {
        await db.query(
          "DROP FUNCTION public.client_organization_invitation_contact_hook(uuid,uuid)",
        );
      }
    },
  );
  await check(
    "org member acceptance clears a demoted primary admin",
    async () => {
      const f = await fixture("org");
      await db.query(
        "INSERT INTO organization_members(organization_id,profile_id,role) VALUES($1,$2,'admin')",
        [f.orgId, f.profileId],
      );
      await db.query(
        "UPDATE organizations SET primary_contact_id=$2 WHERE id=$1",
        [f.orgId, f.profileId],
      );
      await accept(service, f);
      assert.equal(
        (
          await db.query(
            "SELECT primary_contact_id FROM organizations WHERE id=$1",
            [f.orgId],
          )
        ).rows[0].primary_contact_id,
        null,
      );
    },
  );
  for (const kind of ["admin", "org"]) {
    for (const role of ["anon", "authenticated"])
      await check(`${kind} denies ${role}`, async () => {
        const c = await connect(role),
          f = await fixture(kind);
        await assert.rejects(accept(c, f), (e) => e.code === "42501");
        assert.deepEqual(await state(f), { status: "pending", grants: 0 });
      });
    await check(`${kind} denies wrong email and revoked state`, async () => {
      const f = await fixture(kind);
      await assert.rejects(
        accept(service, f, "different@example.invalid"),
        /outro email/,
      );
      await db.query(`UPDATE ${f.table} SET status='revoked' WHERE id=$1`, [
        f.id,
      ]);
      await assert.rejects(accept(service, f), /disponível/);
      assert.deepEqual(await state(f), { status: "revoked", grants: 0 });
    });
    await check(`${kind} expires without granting`, async () => {
      const f = await fixture(kind);
      await db.query(
        `UPDATE ${f.table} SET expires_at=now()-interval '1 day' WHERE id=$1`,
        [f.id],
      );
      assert.equal((await accept(service, f)).rows[0].result.status, "expired");
      assert.deepEqual(await state(f), { status: "expired", grants: 0 });
    });
    await check(
      `${kind} denies mismatched profile even with the invited email`,
      async () => {
        const f = await fixture(kind),
          other = await identity();
        await assert.rejects(
          accept(service, { ...f, profileId: other.profileId }),
          /outro email/,
        );
        assert.deepEqual(await state(f), { status: "pending", grants: 0 });
      },
    );
    await check(
      `${kind} accepted retry does not grant again or duplicate activity`,
      async () => {
        const f = await fixture(kind);
        await accept(service, f);
        const before = await db.query(
          "SELECT count(*) FROM app_activity_events WHERE actor_profile_id=$1",
          [f.profileId],
        );
        if (kind === "admin")
          await db.query(
            "UPDATE user_role_assignments SET role_code='client' WHERE profile_id=$1",
            [f.profileId],
          );
        else
          await db.query(
            "DELETE FROM organization_members WHERE profile_id=$1",
            [f.profileId],
          );
        await accept(service, f);
        assert.equal((await state(f)).grants, 0);
        assert.deepEqual(
          (
            await db.query(
              "SELECT count(*) FROM app_activity_events WHERE actor_profile_id=$1",
              [f.profileId],
            )
          ).rows,
          before.rows,
        );
      },
    );
    await check(
      `${kind} final-write failure rolls access and audit back`,
      async () => {
        const f = await fixture(kind);
        await db.query(
          `CREATE FUNCTION reject_acceptance() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id='${f.id}'::uuid AND NEW.status='accepted' THEN RAISE EXCEPTION 'synthetic final-write failure'; END IF; RETURN NEW; END; $$; CREATE TRIGGER audit_failure BEFORE UPDATE ON ${f.table} FOR EACH ROW EXECUTE FUNCTION reject_acceptance();`,
        );
        try {
          await assert.rejects(
            accept(service, f),
            /synthetic final-write failure/,
          );
          assert.deepEqual(await state(f), { status: "pending", grants: 0 });
          assert.equal(
            (
              await db.query(
                "SELECT count(*)::int n FROM app_activity_events WHERE actor_profile_id=$1",
                [f.profileId],
              )
            ).rows[0].n,
            0,
          );
          if (kind === "org")
            assert.equal(
              (
                await db.query(
                  "SELECT count(*)::int n FROM crm_contacts WHERE profile_id=$1",
                  [f.profileId],
                )
              ).rows[0].n,
              0,
            );
        } finally {
          await db.query(
            `DROP TRIGGER audit_failure ON ${f.table}; DROP FUNCTION reject_acceptance();`,
          );
        }
        await accept(service, f);
        assert.deepEqual(await state(f), { status: "accepted", grants: 1 });
      },
    );
    await check(
      `${kind} locked revocation wins over concurrent acceptance`,
      async () => {
        const f = await fixture(kind),
          first = await connect(),
          second = await connect("service_role");
        await first.query("BEGIN");
        await first.query(
          `UPDATE ${f.table} SET status='revoked' WHERE id=$1`,
          [f.id],
        );
        const pending = accept(second, f);
        const outcome = pending.then(
          () => null,
          (e) => e,
        );
        const pid = (
          await db.query("SELECT pid FROM pg_stat_activity WHERE pid=$1", [
            second.processID,
          ])
        ).rows[0].pid;
        // Observe PostgreSQL's actual lock wait; do not rely on arbitrary sleep.
        let waiting = false;
        for (let i = 0; i < 500; i++) {
          const r = await db.query(
            "SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1",
            [pid],
          );
          if (r.rows[0]?.wait_event_type === "Lock") {
            waiting = true;
            break;
          }
        }
        assert.equal(
          waiting,
          true,
          "acceptance must wait on invitation row lock",
        );
        await first.query("COMMIT");
        assert.match((await outcome).message, /disponível/);
        assert.deepEqual(await state(f), { status: "revoked", grants: 0 });
      },
    );
    await check(
      `${kind} activity failure rolls the terminal state back`,
      async () => {
        const f = await fixture(kind);
        await db.query(
          `CREATE FUNCTION reject_activity() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.actor_profile_id='${f.profileId}'::uuid THEN RAISE EXCEPTION 'synthetic activity failure'; END IF; RETURN NEW; END; $$; CREATE TRIGGER audit_failure BEFORE INSERT ON app_activity_events FOR EACH ROW EXECUTE FUNCTION reject_activity();`,
        );
        try {
          await assert.rejects(
            accept(service, f),
            /synthetic activity failure/,
          );
          assert.deepEqual(await state(f), { status: "pending", grants: 0 });
          if (kind === "admin")
            assert.equal(
              (
                await db.query(
                  "SELECT count(*)::int n FROM role_change_audit WHERE target_profile_id=$1",
                  [f.profileId],
                )
              ).rows[0].n,
              0,
            );
        } finally {
          await db.query(
            "DROP TRIGGER audit_failure ON app_activity_events; DROP FUNCTION reject_activity();",
          );
        }
      },
    );
    await check(
      `${kind} accepted transition wins over a pending-only revocation`,
      async () => {
        const f = await fixture(kind),
          first = await connect("service_role"),
          second = await connect("service_role");
        await first.query("BEGIN");
        await accept(first, f);
        const pending = second.query(
          `UPDATE ${f.table} SET status='revoked' WHERE id=$1 AND status='pending'`,
          [f.id],
        );
        let waiting = false;
        for (let i = 0; i < 500; i++) {
          const r = await db.query(
            "SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1",
            [second.processID],
          );
          if (r.rows[0]?.wait_event_type === "Lock") {
            waiting = true;
            break;
          }
        }
        assert.equal(waiting, true);
        await first.query("COMMIT");
        assert.equal((await pending).rowCount, 0);
        assert.deepEqual(await state(f), { status: "accepted", grants: 1 });
      },
    );
    await check(`${kind} concurrent accepts log exactly once`, async () => {
      const f = await fixture(kind),
        second = await connect("service_role");
      await Promise.all([accept(service, f), accept(second, f)]);
      assert.deepEqual(await state(f), { status: "accepted", grants: 1 });
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int n FROM app_activity_events WHERE actor_profile_id=$1",
            [f.profileId],
          )
        ).rows[0].n,
        1,
      );
    });
  }
  await checkMembershipIdentity({ db, service, connect, check, fixture, assign, accept, state, waitForLock });
  await checkIdentityMigrationPrerequisites({ cluster, check, root });
  await checkGeneratedTopologies({ cluster, check, root });
  await checkProjects({ db, connect, check, root });
  await checkProjectInheritance({ db, service, connect, check, identity, assign });
  await checkProjectsRelationships({ db, connect, check, root });
  await checkClientTasks({ db, connect, check, root });
  await checkClientTaskMigrationPrerequisites({ cluster, check, root });
  await checkWorkflowTransactions({ db, service, connect, check, root });
  console.log(`${passed} PostgreSQL integration checks passed`);
} finally {
  await Promise.allSettled(connections.map((c) => c.end()));
  await cluster.stop();
  await rm(directory, { recursive: true, force: true });
}
