import assert from "node:assert/strict";
import test from "node:test";

import {
  DATABASE_INVITATION_CONTACT_INTEGRATION,
  inviteOrganizationMembers,
  resendOrganizationInvitation,
} from "../packages/module-orgs/src/invitations.ts";

function queryResult<T>(result: T) {
  const query: Record<string, unknown> = {};
  for (const method of ["eq", "in", "order", "limit", "update", "delete", "upsert"] as const) {
    query[method] = () => query;
  }
  query.maybeSingle = async () => result;
  query.then = (resolve: (value: T) => unknown, reject: (error: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return query;
}

test("same-role retries reconcile CRM and pending invitations through the database transaction", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const client = directMemberClient({
    members: [{ profile_id: "profile-1", role: "member", profile: { email: "person@example.com" } }],
    rpc: async (args) => { calls.push(args); return { data: { status: "already_member" }, error: null }; },
  });
  const callback = async () => { throw new Error("contact linking must execute inside the transaction"); };
  Object.defineProperty(callback, DATABASE_INVITATION_CONTACT_INTEGRATION, { value: true });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await inviteOrganizationMembers(client as never, "org-1", [{ email: " Person@Example.com ", role: "member" }], "actor-1", { ensureCrmContactForProfile: callback });
    assert.deepEqual(result.outcomes, [{ email: "person@example.com", role: "member", status: "already_member", profileId: "profile-1" }]);
    assert.equal(result.summary.unchangedExistingMembers, 1);
  }
  assert.deepEqual(calls, [0, 1].map(() => ({ p_organization_id: "org-1", p_profile_id: "profile-1", p_email: "person@example.com", p_role: "member", p_actor_profile_id: "actor-1" })));
});

function directMemberClient(options: {
  members?: Array<Record<string, unknown>>;
  profiles?: Array<Record<string, unknown>>;
  rpc: (args: Record<string, unknown>) => Promise<unknown>;
}) {
  return {
    from(table: string) {
      // No mutation methods: all direct-member side effects belong to the RPC.
      if (table === "organization_members") return { select: () => queryResult({ data: options.members ?? [], error: null }) };
      if (table === "profiles") return { select: () => queryResult({ data: options.profiles ?? options.members?.map((member) => ({ id: member.profile_id, email: (member.profile as { email: string }).email })) ?? [], error: null }) };
      if (table === "organization_invitations") return { select: () => queryResult({ data: [], error: null }) };
      if (table === "organizations") return { select: () => queryResult({ data: { name: "Synthetic" }, error: null }) };
      throw new Error(`unexpected table ${table}`);
    },
    async rpc(name: string, args: Record<string, unknown>) {
      assert.equal(name, "assign_organization_member_atomic");
      return options.rpc(args);
    },
  };
}

for (const explicitDatabaseIntegration of [false, true]) test(`custom contact callback ${explicitDatabaseIntegration ? "delegates to an explicitly migrated database hook" : "is rejected before accessing the database"}`, async () => {
  let databaseCalls = 0;
  const callback = async () => { throw new Error("custom JavaScript callback cannot join a database transaction"); };
  const client = directMemberClient({
    profiles: [{ id: "profile-1", email: "person@example.com" }],
    rpc: async () => { databaseCalls += 1; return { data: { status: "immediate_access" }, error: null }; },
  });
  const originalFrom = client.from;
  client.from = (table) => { databaseCalls += 1; return originalFrom(table); };
  const operation = () => inviteOrganizationMembers(client as never, "org-1", [{ email: "person@example.com", role: "member" }], "actor-1", {
    ensureCrmContactForProfile: callback,
    ...(explicitDatabaseIntegration ? { contactIntegration: "database" as const } : {}),
  });
  if (explicitDatabaseIntegration) {
    assert.equal((await operation()).outcomes[0]?.status, "immediate_access");
    assert.ok(databaseCalls > 0);
  } else {
    await assert.rejects(operation, /INVITATION_CONTACT_INTEGRATION_MIGRATION_REQUIRED/);
    assert.equal(databaseCalls, 0);
  }
});

test("email delivery failure is a per-person outcome and removes only the failed new invitation", async () => {
  let deletedInvitation = false;
  const client = {
    from(table: string) {
      if (table === "organization_members" || table === "profiles") {
        return { select: () => queryResult({ data: [], error: null }) };
      }
      if (table === "organizations") return { select: () => queryResult({ data: { name: "Acme" }, error: null }) };
      if (table === "organization_invitations") {
        return {
          select(columns: string) {
            return queryResult({
              data: columns.includes("expires_at") && !columns.includes("created_at")
                ? [{ id: "invite-1", invited_email: "new@example.com", role: "member", expires_at: "2026-09-01T00:00:00.000Z" }]
                : [],
              error: null,
            });
          },
          upsert: () => queryResult({ data: null, error: null }),
          delete() {
            deletedInvitation = true;
            return queryResult({ data: null, error: null });
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };

  const result = await inviteOrganizationMembers(
    client as never,
    "org-1",
    [{ email: "new@example.com", role: "member" }],
    "actor-1",
    { sendInviteEmail: async () => false },
  );

  assert.equal(deletedInvitation, true);
  assert.equal(result.summary.failedEmailDeliveries, 1);
  assert.equal(result.outcomes[0]?.status, "email_failed");
});

test("an expired pending row is replaced with a fresh invitation instead of reported as a duplicate", async () => {
  const client = {
    from(table: string) {
      if (table === "organization_members" || table === "profiles") {
        return { select: () => queryResult({ data: [], error: null }) };
      }
      if (table === "organizations") return { select: () => queryResult({ data: { name: "Acme" }, error: null }) };
      if (table === "organization_invitations") {
        return {
          select(columns: string) {
            if (columns.includes("status") && !columns.includes("created_at")) {
              return queryResult({ data: [{ id: "old-invite", invited_email: "new@example.com", role: "member", status: "pending", expires_at: "2020-01-01T00:00:00.000Z" }], error: null });
            }
            if (!columns.includes("created_at")) {
              return queryResult({ data: [{ id: "fresh-invite", invited_email: "new@example.com", role: "member", expires_at: "2099-01-01T00:00:00.000Z" }], error: null });
            }
            return queryResult({ data: [], error: null });
          },
          upsert: () => queryResult({ data: null, error: null }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };

  const result = await inviteOrganizationMembers(
    client as never,
    "org-1",
    [{ email: "new@example.com", role: "member" }],
    "actor-1",
    { sendInviteEmail: async () => true },
  );

  assert.equal(result.outcomes[0]?.status, "pending_invitation");
  assert.equal(result.outcomes[0]?.invitationId, "fresh-invite");
});

test("transaction failures remain per-person outcomes and later members still succeed", async () => {
  const attempted: unknown[] = [];
  const profiles = ["write-failure", "crm-failure", "success"].map((id) => ({ id, email: `${id}@example.com` }));
  const client = directMemberClient({ profiles, rpc: async (args) => {
    attempted.push(args.p_profile_id);
    if (args.p_profile_id === "write-failure") return { data: null, error: { message: "write failed" } };
    if (args.p_profile_id === "crm-failure") return { data: null, error: { code: "BW001", message: "synthetic contact integration failure" } };
    return { data: { status: "immediate_access" }, error: null };
  } });
  const result = await inviteOrganizationMembers(client as never, "org-1", profiles.map(({ email }) => ({ email, role: "member" as const })), "actor-1");
  assert.deepEqual(attempted, ["write-failure", "crm-failure", "success"]);
  assert.deepEqual(result.outcomes.map(({ status, failureKind }) => ({ status, failureKind })), [
    { status: "api_failed", failureKind: "membership" },
    { status: "api_failed", failureKind: "crm_link" },
    { status: "immediate_access", failureKind: undefined },
  ]);
  assert.equal(result.summary.failedApiOperations, 2);
  assert.equal(result.summary.failedContactLinks, 1);
  assert.equal(result.summary.directAssignments, 1);
});

for (const response of [
  { data: { status: "unexpected" }, error: null },
  { data: null, error: null },
  { data: null, error: { code: "", message: "Failed to fetch" } },
]) test(`unconfirmed transaction result ${JSON.stringify(response)} stays a per-person failure with no compensation`, async () => {
  let attempts = 0;
  const client = directMemberClient({
    profiles: [{ id: "profile-1", email: "person@example.com" }, { id: "profile-2", email: "next@example.com" }],
    rpc: async () => ++attempts === 1 ? response : { data: { status: "immediate_access" }, error: null },
  });
  const result = await inviteOrganizationMembers(client as never, "org-1", [
    { email: "person@example.com", role: "member" }, { email: "next@example.com", role: "member" },
  ], "actor-1");
  assert.deepEqual(result.outcomes.map(({ status }) => status), ["api_failed", "immediate_access"]);
  assert.equal(result.outcomes[0]?.failureKind, "membership");
  assert.equal(result.summary.failedApiOperations, 1);
  assert.equal(result.summary.failedContactLinks, 0);
  assert.equal(attempts, 2);
});

for (const status of ["immediate_access", "membership_updated", "already_member"] as const) test(`the locked database result determines ${status}, without inferring outcomes from profile existence`, async () => {
  const client = directMemberClient({
    members: [{ profile_id: "profile-1", role: "member", profile: { email: "person@example.com" } }],
    rpc: async () => ({ data: { status }, error: null }),
  });
  const result = await inviteOrganizationMembers(client as never, "org-1", [{ email: "person@example.com", role: "admin" }], "actor-1");
  assert.equal(result.outcomes[0]?.status, status);
  assert.equal(result.summary.directAssignments, Number(status === "immediate_access"));
  assert.equal(result.summary.updatedExistingMembers, Number(status === "membership_updated"));
  assert.equal(result.summary.unchangedExistingMembers, Number(status === "already_member"));
});

test("resend keeps a pending invitation when email delivery fails", async () => {
  let writes = 0;
  const invitation = {
    id: "invite-1",
    organization_id: "org-1",
    invited_email: "person@example.com",
    role: "member",
    status: "pending",
    invited_by_profile_id: "actor-1",
    accepted_at: null,
    accepted_by_profile_id: null,
    accepted_contact_id: null,
    revoked_at: null,
    expires_at: "2099-09-01T00:00:00.000Z",
    created_at: "2026-08-16T00:00:00.000Z",
    organizations: { name: "Acme" },
  };
  const client = {
    from(table: string) {
      assert.equal(table, "organization_invitations");
      return {
        select: () => queryResult({ data: invitation, error: null }),
        update: () => {
          writes += 1;
          return queryResult({ data: null, error: null });
        },
        delete: () => {
          writes += 1;
          return queryResult({ data: null, error: null });
        },
      };
    },
  };

  await assert.rejects(
    resendOrganizationInvitation(client as never, "org-1", "invite-1", { sendInviteEmail: async () => false }),
    /convite pendente foi mantido/,
  );
  assert.equal(writes, 0);
});

test("a failed final invitation refresh does not discard completed per-person outcomes", async () => {
  let invitationSelects = 0;
  const client = directMemberClient({
    profiles: [{ id: "profile-1", email: "person@example.com" }],
    rpc: async () => ({ data: { status: "immediate_access" }, error: null }),
  });
  const originalFrom = client.from;
  client.from = (table) => {
    if (table === "organization_invitations") return { select: () => {
      invitationSelects += 1;
      return queryResult(invitationSelects === 1 ? { data: [], error: null } : { data: null, error: { message: "refresh failed" } });
    } };
    return originalFrom(table);
  };
  const result = await inviteOrganizationMembers(client as never, "org-1", [{ email: "person@example.com", role: "member" }], "actor-1");
  assert.equal(result.outcomes[0]?.status, "immediate_access");
  assert.deepEqual(result.invitations, []);
});

test("failed email cleanup retains invitation identity and accurate retry guidance", async () => {
  const client = {
    from(table: string) {
      if (table === "organization_members" || table === "profiles") return { select: () => queryResult({ data: [], error: null }) };
      if (table === "organizations") return { select: () => queryResult({ data: { name: "Synthetic" }, error: null }) };
      return {
        select: () => queryResult({ data: [{ id: "invite-retained", invited_email: "synthetic@example.invalid", role: "member", expires_at: "2099-01-01" }], error: null }),
        upsert: () => queryResult({ data: null, error: null }),
        delete: () => queryResult({ error: { message: "synthetic cleanup failure" } }),
      };
    },
  };
  const result = await inviteOrganizationMembers(client as never, "org-1", [{ email: "synthetic@example.invalid", role: "member" }], "actor-1", { sendInviteEmail: async () => false });
  assert.equal(result.outcomes[0]?.status, "email_failed");
  assert.equal(result.outcomes[0]?.invitationId, "invite-retained");
  assert.match(result.outcomes[0]?.message ?? "", /mantido/);
  assert.doesNotMatch(result.outcomes[0]?.message ?? "", /não foi guardado/);
});
