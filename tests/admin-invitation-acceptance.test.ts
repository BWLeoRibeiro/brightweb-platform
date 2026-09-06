import assert from "node:assert/strict";
import test from "node:test";
import { acceptAdminUserInvitation } from "../packages/module-admin/src/invitations.ts";
import { acceptOrganizationInvitation } from "../packages/module-orgs/src/invitations.ts";

for (const kind of ["admin", "organization"] as const) {
  const run = (client: unknown) => kind === "admin"
    ? acceptAdminUserInvitation(client as never, { invitationId: "invite-1", profileId: "profile-1", userEmail: " Person@Example.com " })
    : acceptOrganizationInvitation(client as never, { invitationId: "invite-1", profileId: "profile-1", userEmail: " Person@Example.com ", contactIntegration: "database", ensureCrmContactForProfile: async () => { throw new Error("CRM must join the database transaction"); } });
  test(`${kind} acceptance uses one atomic operation and validates its result`, async () => {
    let calls = 0;
    const result = await run({
      from() { throw new Error("Separate table writes are not atomic"); },
      async rpc(name: string, params: unknown) {
        calls += 1;
        assert.equal(name, kind === "admin" ? "accept_admin_user_invitation" : "accept_organization_invitation");
        assert.deepEqual(params, { p_invitation_id: "invite-1", p_profile_id: "profile-1", p_user_email: "person@example.com" });
        return { data: { status: "accepted", role: "staff", organizationId: "org-1" }, error: null };
      },
    });
    assert.equal(calls, 1);
    assert.deepEqual(result, kind === "admin" ? { role: "staff" } : { organizationId: "org-1" });
    await assert.rejects(run({ rpc: async () => ({ data: null, error: null }) }), /confirmar/);
  });
  test(`${kind} acceptance propagates denial, expiration and unavailable migrations without legacy writes`, async () => {
    for (const message of ["Este convite pertence a outro email.", "Este convite já não está disponível.", "function not found"]) {
      await assert.rejects(run({ rpc: async () => ({ error: { message } }) }), { message });
    }
    await assert.rejects(run({ rpc: async () => ({ data: { status: "expired" }, error: null }) }), /expirou/);
  });
}

test("admin cleanup failure is exposed as a retained-invitation recovery outcome", async () => {
  const { createAdminUserInvitation, ADMIN_USER_INVITE_CLEANUP_FAILED_ERROR } = await import("../packages/module-admin/src/invitations.ts");
  const { createAdminUserInvitationsHandler } = await import("../packages/module-admin/src/http.ts");
  const row = { id: "invite-1", invited_email: "synthetic@example.invalid", role_code: "staff", status: "pending", created_at: "2026-01-01", expires_at: "2099-01-01" };
  const client = { auth: { admin: { listUsers: async () => ({ data: { users: [] }, error: null }) } }, from() {
    let deleting = false;
    const q: Record<string, unknown> = {};
    for (const name of ["update", "eq", "lte", "insert", "select"]) q[name] = () => q;
    q.delete = () => { deleting = true; return q; };
    q.single = async () => ({ data: row, error: null });
    q.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ error: deleting ? { message: "synthetic cleanup failure" } : null }).then(resolve);
    return q;
  } };
  await assert.rejects(createAdminUserInvitation(client as never, { email: row.invited_email, role: "staff", invitedByProfileId: "actor-1" }, { sendInviteEmail: async () => false }), { message: ADMIN_USER_INVITE_CLEANUP_FAILED_ERROR });
  const handlers = createAdminUserInvitationsHandler({
    getAccess: async () => ({ ok: true, profileId: "actor-1" }), getServiceClient: () => client,
    createInvitation: async () => { throw new Error(ADMIN_USER_INVITE_CLEANUP_FAILED_ERROR); },
  } as never);
  const response = await handlers.POST(new Request("https://example.invalid/invitations", { method: "POST", body: JSON.stringify({ email: row.invited_email, role: "staff" }) }));
  assert.equal(response.status, 502);
  const payload = await response.json();
  assert.equal(payload.error.code, "INVITATION_CLEANUP_FAILED");
  assert.match(payload.error.message, /mantido/);
});

for (const kind of ["admin", "organization"] as const) test(`${kind} registration retries an accepted identity through the same acceptance operation`, async () => {
  const { registerUserFromAdminInvitation } = await import("../packages/module-admin/src/invitations.ts");
  const { registerUserFromOrganizationInvitation } = await import("../packages/module-orgs/src/invitations.ts");
  const calls: string[] = [];
  const invitation = { id: "invite-1", organization_id: "org-1", invited_email: "synthetic@example.invalid", role_code: "staff", role: "member", status: "accepted", accepted_by_profile_id: "profile-1", expires_at: "2020-01-01", organizations: { name: "Synthetic" } };
  const client = {
    auth: { admin: {
      createUser: async () => { throw new Error("Replay must not create or mutate identity"); },
      listUsers: async () => ({ data: { users: [{ id: "user-1", email: invitation.invited_email }] }, error: null }),
      deleteUser: async () => { throw new Error("An accepted identity must not be deleted"); },
    } },
    from(table: string) { const q: Record<string, unknown> = {}; q.select = q.eq = () => q; q.maybeSingle = async () => ({ data: table === "profiles" ? { id: "profile-1" } : invitation, error: null }); return q; },
    rpc: async (name: string) => { calls.push(name); return { data: name.startsWith("accept_") ? { status: "accepted", role: "staff", organizationId: "org-1" } : null, error: null }; },
  };
  const params = { invitationId: "invite-1", firstName: "Synthetic", lastName: "Fixture", password: "synthetic-unused-password" };
  if (kind === "admin") await registerUserFromAdminInvitation(client as never, params);
  else await registerUserFromOrganizationInvitation(client as never, { ...params, contactIntegration: "database", ensureCrmContactForProfile: async () => { throw new Error("link must execute in transaction"); } });
  assert.deepEqual(calls, [kind === "admin" ? "accept_admin_user_invitation" : "accept_organization_invitation"]);
});

test("organization custom callbacks require explicit transactional migration before any operation", async () => {
  const { registerUserFromOrganizationInvitation, DATABASE_INVITATION_CONTACT_INTEGRATION } = await import("../packages/module-orgs/src/invitations.ts");
  const callback = async () => ({ success: true });
  const client = { from() { throw new Error("must not read or write"); }, rpc: async () => ({ data: { status: "accepted", organizationId: "org-1" }, error: null }) };
  const base = { invitationId: "invite-1", profileId: "profile-1", userEmail: "synthetic@example.invalid", ensureCrmContactForProfile: callback };
  await assert.rejects(acceptOrganizationInvitation(client as never, base), /INTEGRATION_MIGRATION_REQUIRED/);
  await assert.rejects(registerUserFromOrganizationInvitation(client as never, { ...base, firstName: "", lastName: "", password: "unused" }), /INTEGRATION_MIGRATION_REQUIRED/);
  assert.deepEqual(await acceptOrganizationInvitation(client as never, { ...base, contactIntegration: "database" }), { organizationId: "org-1" });
  Object.defineProperty(callback, DATABASE_INVITATION_CONTACT_INTEGRATION, { value: true });
  assert.deepEqual(await acceptOrganizationInvitation(client as never, base), { organizationId: "org-1" });
  assert.deepEqual(await acceptOrganizationInvitation(client as never, { ...base, ensureCrmContactForProfile: undefined }), { organizationId: "org-1" });
});

for (const kind of ["admin", "organization"] as const) test(`${kind} accepted registration rejects a deleted original profile without identity writes`, async () => {
  const { registerUserFromAdminInvitation } = await import("../packages/module-admin/src/invitations.ts");
  const { registerUserFromOrganizationInvitation } = await import("../packages/module-orgs/src/invitations.ts");
  const client = { from() { const q: Record<string, unknown> = {}; q.select = q.eq = () => q; q.maybeSingle = async () => ({ data: { id: "invite-1", status: "accepted", accepted_by_profile_id: null }, error: null }); return q; } };
  const params = { invitationId: "invite-1", firstName: "", lastName: "", password: "unused" };
  await assert.rejects(kind === "admin" ? registerUserFromAdminInvitation(client as never, params) : registerUserFromOrganizationInvitation(client as never, params), /INVITATION_NOT_AVAILABLE/);
});

test("stock CRM callback carries the shared database integration contract", async () => {
  const { ensureCrmContactForProfile } = await import("../packages/module-crm/src/server.ts");
  const { DATABASE_INVITATION_CONTACT_INTEGRATION } = await import("../packages/module-orgs/src/invitations.ts");
  assert.equal(Reflect.get(ensureCrmContactForProfile, DATABASE_INVITATION_CONTACT_INTEGRATION), true);
  const result = await acceptOrganizationInvitation({ rpc: async () => ({ data: { status: "accepted", organizationId: "org-1" }, error: null }) } as never, { invitationId: "invite-1", profileId: "profile-1", userEmail: "synthetic@example.invalid", ensureCrmContactForProfile });
  assert.deepEqual(result, { organizationId: "org-1" });
});
