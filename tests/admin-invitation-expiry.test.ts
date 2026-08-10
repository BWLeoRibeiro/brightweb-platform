import assert from "node:assert/strict";
import test from "node:test";

import { listAdminUserInvitations } from "../packages/module-admin/src/invitations.ts";
import { defaultAdminUiDictionary } from "../packages/module-admin/src/ui/dictionary.ts";
import { formatInvitationExpiry } from "../packages/module-admin/src/ui/invitation-expiry.ts";

function createInvitationListClient(expiresAt: string) {
  const invitation = {
    id: "invite-1",
    invited_email: "person@example.com",
    role_code: "staff",
    status: "pending",
    invited_by_profile_id: "inviter-1",
    accepted_by_profile_id: null,
    accepted_at: null,
    revoked_at: null,
    expires_at: expiresAt,
    created_at: "2026-06-27T12:00:00.000Z",
  };
  const writes: Array<Record<string, unknown>> = [];

  const client = {
    from(table: string) {
      assert.equal(table, "admin_user_invitations");
      return {
        update(value: Record<string, unknown>) {
          writes.push(value);
          return {
            eq(_column: string, expectedStatus: string) {
              return {
                lte: async (_expiresColumn: string, cutoff: string) => {
                  if (invitation.status === expectedStatus && invitation.expires_at <= cutoff) {
                    invitation.status = String(value.status);
                  }
                  return { error: null };
                },
              };
            },
          };
        },
        select() {
          return {
            order() {
              return {
                limit: async () => ({ data: [invitation], error: null }),
              };
            },
          };
        },
      };
    },
  };

  return { client, writes };
}

test("listing admin invitations expires stale pending rows before returning them", async () => {
  const { client, writes } = createInvitationListClient("2026-06-28T12:00:00.000Z");

  const invitations = await listAdminUserInvitations(client as never);

  assert.equal(invitations[0]?.status, "expired");
  assert.deepEqual(writes, [{ status: "expired" }]);
});

test("admin invitation expiry labels distinguish expired, today, and soon", () => {
  const now = new Date("2026-08-05T10:00:00.000Z");

  assert.equal(
    formatInvitationExpiry("2026-08-04T10:00:00.000Z", "pt-PT", defaultAdminUiDictionary, now),
    "Expirado",
  );
  assert.equal(
    formatInvitationExpiry("2026-08-05T18:00:00.000Z", "pt-PT", defaultAdminUiDictionary, now),
    "Expira hoje",
  );
  assert.equal(
    formatInvitationExpiry("2026-08-07T10:00:00.000Z", "pt-PT", defaultAdminUiDictionary, now),
    "Expira dentro de 2 dias",
  );
});
