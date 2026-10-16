import assert from "node:assert/strict";
import test from "node:test";
import {
  acceptAdminUserInvitation,
  createAdminUserInvitation,
  registerUserFromAdminInvitation,
} from "../packages/module-admin/src/invitations.ts";
import {
  acceptOrganizationInvitation,
  inviteOrganizationMembers,
  registerUserFromOrganizationInvitation,
} from "../packages/module-orgs/src/invitations.ts";

const email = "person@example.invalid";
const identity = { userId: "auth-1", profileId: "profile-1", email, confirmed: true };
const registration = { invitationId: "invite-1", firstName: "Synthetic", lastName: "Fixture", password: "unused" };
const acceptance = { invitationId: "invite-1", profileId: "profile-1", userEmail: email };
const draft = [{ email, role: "member" as const }];
const invitation = {
  id: "invite-1", organization_id: "org-1", invited_email: email, role_code: "staff", role: "member",
  status: "pending", expires_at: "2099-01-01", organizations: { name: "Synthetic" },
};

function readResult(data: unknown) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order"]) query[method] = () => query;
  query.maybeSingle = async () => ({ data, error: null });
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve);
  return query;
}

const operations = [
  { name: "admin create", readiness: "assert_admin_auth_identity_v1", run: (client: never) => createAdminUserInvitation(client, { email, role: "staff", invitedByProfileId: "actor-1" }) },
  { name: "admin register", readiness: "assert_admin_auth_identity_v1", run: (client: never) => registerUserFromAdminInvitation(client, registration) },
  { name: "admin accept", readiness: "assert_admin_auth_identity_v1", run: (client: never) => acceptAdminUserInvitation(client, acceptance) },
  { name: "orgs invite", readiness: "assert_orgs_auth_identity_v1", run: (client: never) => inviteOrganizationMembers(client, "org-1", draft, "actor-1") },
  { name: "orgs register", readiness: "assert_orgs_auth_identity_v1", run: (client: never) => registerUserFromOrganizationInvitation(client, registration) },
  { name: "orgs accept", readiness: "assert_orgs_auth_identity_v1", run: (client: never) => acceptOrganizationInvitation(client, acceptance) },
];

for (const operation of operations) for (const code of ["42883", "PGRST202", "BW003"]) {
  test(`${operation.name} fails before reads or mutations when module readiness fails with ${code}`, async () => {
    const calls: string[] = [];
    const client = {
      from: () => assert.fail("incomplete identity migrations must stop before table access"),
      auth: { admin: { createUser: () => assert.fail("readiness must precede Auth creation") } },
      rpc: async (name: string) => {
        calls.push(name);
        assert.equal(name, operation.readiness);
        return { data: null, error: { code, message: "IDENTITY_MIGRATION_REQUIRED: incomplete migration" } };
      },
    };
    await assert.rejects(operation.run(client as never), /IDENTITY_MIGRATION_REQUIRED/);
    assert.deepEqual(calls, [operation.readiness]);
  });
}

test("empty organization invite batches do not require database access", async () => {
  const result = await inviteOrganizationMembers({} as never, "org-1", [], "actor-1");
  assert.deepEqual(result.outcomes, []);
});

for (const kind of ["admin", "organization"] as const) {
  const run = (client: never) => kind === "admin"
    ? createAdminUserInvitation(client, { email, role: "staff", invitedByProfileId: "actor-1" })
    : inviteOrganizationMembers(client, "org-1", draft, "actor-1");
  const clientForResolver = (data: unknown, error: { code: string; message: string } | null = null) => ({
    auth: { admin: { listUsers: () => assert.fail("Auth scans cannot replace the resolver") } },
    rpc: async (name: string) => name.startsWith("assert_") ? { data: null, error: null } : { data, error },
    from(table: string) {
      assert.equal(table, "organization_invitations");
      return readResult([]);
    },
  });
  for (const code of ["42883", "PGRST202"]) test(`${kind} does not fall back when identity resolution is missing (${code})`, async () => {
    await assert.rejects(run(clientForResolver(null, { code, message: "function missing" }) as never), /IDENTITY_MIGRATION_REQUIRED/);
  });
  for (const data of [
    undefined, false, [], {}, { ...identity, userId: "" }, { ...identity, email: "other@example.invalid" },
    { ...identity, email: undefined }, { ...identity, confirmed: undefined }, { ...identity, confirmed: "true" },
    { ...identity, profileId: undefined }, { ...identity, profileId: " " },
  ]) test(`${kind} rejects malformed identity resolution ${JSON.stringify(data)} without grants, invitations or emails`, async () => {
    await assert.rejects(run(clientForResolver(data) as never), /AUTH_IDENTITY_INVALID_RESPONSE/);
  });
  for (const code of ["21000", "42501"]) test(`${kind} identity resolution ${code} cannot become a pending invitation`, async () => {
    await assert.rejects(run(clientForResolver(null, { code, message: "synthetic resolution denial" }) as never), /resolution denial/);
  });
}

test("identity conflicts fail per recipient and never fall back to an existing pending invitation", async () => {
  const grants: unknown[] = [];
  const client = {
    async rpc(name: string, params: Record<string, unknown>) {
      if (name === "assert_orgs_auth_identity_v1") return { data: null, error: null };
      if (name === "resolve_auth_identity") return params.p_email === email
        ? { data: null, error: { code: "BW002", message: "reconciliation required" } }
        : { data: { ...identity, email: "next@example.invalid" }, error: null };
      assert.equal(name, "assign_organization_member_atomic");
      grants.push(params.p_email);
      return { data: { status: "immediate_access" }, error: null };
    },
    from(table: string) {
      if (table === "organizations") return readResult({ name: "Synthetic" });
      assert.equal(table, "organization_invitations");
      return readResult([{ id: "pending-1", invited_email: email, role: "member", status: "pending", expires_at: "2099-01-01" }]);
    },
  };
  const result = await inviteOrganizationMembers(client as never, "org-1", [...draft, { email: "next@example.invalid", role: "member" }], "actor-1", {
    sendInviteEmail: async () => assert.fail("a reconciliation failure must never send a new invitation"),
  });
  assert.deepEqual(grants, ["next@example.invalid"]);
  assert.deepEqual(result.outcomes.map(({ status }) => status), ["api_failed", "immediate_access"]);
  assert.equal(result.outcomes[0]?.failureKind, "membership");
  assert.equal(result.outcomes[0]?.invitationId, undefined);
  assert.match(result.outcomes[0]?.message ?? "", /reconciliação/);
  assert.equal(result.summary.failedApiOperations, 1);
});

for (const kind of ["admin", "organization"] as const) {
  test(`${kind} registration cannot turn a conflicting existing identity into trusted profile synchronization`, async () => {
    const calls: string[] = [];
    const client = {
      auth: { admin: {
        createUser: async () => ({ data: { user: null }, error: { message: "User already registered" } }),
        listUsers: () => assert.fail("reconciliation cannot fall back to scanning Auth"),
      } },
      from(table: string) { assert.match(table, /invitations$/); return readResult(invitation); },
      async rpc(name: string) {
        calls.push(name);
        if (name.startsWith("assert_")) return { data: null, error: null };
        assert.equal(name, "resolve_auth_identity");
        return { data: null, error: { code: "BW002", message: "reconciliation required" } };
      },
    };
    await assert.rejects(kind === "admin"
      ? registerUserFromAdminInvitation(client as never, registration)
      : registerUserFromOrganizationInvitation(client as never, registration), /reconciliation required/);
    assert.deepEqual(calls, [kind === "admin" ? "assert_admin_auth_identity_v1" : "assert_orgs_auth_identity_v1", "resolve_auth_identity"]);
  });
  test(`${kind} registration recovers a confirmed identity with no profile through trusted sync and atomic acceptance`, async () => {
    const calls: string[] = [];
    const client = {
      auth: { admin: {
        createUser: async () => ({ data: { user: null }, error: { message: "User already registered" } }),
        listUsers: () => assert.fail("profile recovery must use the resolver"),
      } },
      from(table: string) { return readResult(table === "profiles" ? { id: "profile-1" } : invitation); },
      async rpc(name: string, params: Record<string, unknown>) {
        calls.push(name);
        if (name.startsWith("assert_")) return { data: null, error: null };
        if (name === "resolve_auth_identity") return { data: { ...identity, profileId: null }, error: null };
        if (name === "sync_profile_from_auth_identity") {
          assert.equal(params.p_user_id, identity.userId);
          return { data: null, error: null };
        }
        assert.equal(params.p_profile_id, "profile-1");
        return { data: { status: "accepted", role: "staff", organizationId: "org-1" }, error: null };
      },
    };
    const result = kind === "admin" ? await registerUserFromAdminInvitation(client as never, registration)
      : await registerUserFromOrganizationInvitation(client as never, registration);
    assert.equal(result.email, email);
    assert.ok(calls.includes("sync_profile_from_auth_identity"));
    assert.equal(calls.at(-1), kind === "admin" ? "accept_admin_user_invitation" : "accept_organization_invitation");
  });
}
