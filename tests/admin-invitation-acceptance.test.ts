import assert from "node:assert/strict";
import test from "node:test";

import { acceptAdminUserInvitation } from "../packages/module-admin/src/invitations.ts";

function createInvitationClient() {
  const writes: Array<{ table: string; value: Record<string, unknown> }> = [];
  const invitation = {
    id: "invite-1",
    invited_email: "person@example.com",
    role_code: "staff",
    status: "pending",
    expires_at: "2099-08-10T00:00:00.000Z",
  };

  const client = {
    from(table: string) {
      return {
        select(columns: string) {
          return {
            eq(_column: string, _value: string) {
              if (table === "admin_user_invitations" && columns.includes("role_code")) {
                return { maybeSingle: async () => ({ data: invitation, error: null }) };
              }
              if (table === "admin_user_invitations") {
                return { single: async () => ({ data: { invited_by_profile_id: "inviter-1" }, error: null }) };
              }
              return { maybeSingle: async () => ({ data: { role_code: "client" }, error: null }) };
            },
          };
        },
        update(value: Record<string, unknown>) {
          writes.push({ table, value });
          return {
            eq() {
              return { eq: async () => ({ error: null }) };
            },
          };
        },
        upsert: async (value: Record<string, unknown>) => {
          writes.push({ table, value });
          return { error: null };
        },
        insert: async (value: Record<string, unknown>) => {
          writes.push({ table, value });
          return { error: null };
        },
      };
    },
    rpc: async () => ({ error: null }),
  };

  return { client, writes };
}

test("admin invitations can be accepted by an existing matching account", async () => {
  const { client, writes } = createInvitationClient();
  const result = await acceptAdminUserInvitation(client as never, {
    invitationId: "invite-1",
    profileId: "profile-1",
    userEmail: "Person@Example.com",
  });

  assert.deepEqual(result, { role: "staff" });
  assert.ok(writes.some(({ table, value }) =>
    table === "user_role_assignments"
    && value.profile_id === "profile-1"
    && value.role_code === "staff"));
  assert.ok(writes.some(({ table, value }) =>
    table === "admin_user_invitations"
    && value.status === "accepted"
    && value.accepted_by_profile_id === "profile-1"));
});

test("admin invitation acceptance rejects a different signed-in email", async () => {
  const { client, writes } = createInvitationClient();
  await assert.rejects(
    acceptAdminUserInvitation(client as never, {
      invitationId: "invite-1",
      profileId: "profile-1",
      userEmail: "other@example.com",
    }),
    /outro email/,
  );
  assert.equal(writes.length, 0);
});
