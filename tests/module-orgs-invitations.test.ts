import assert from "node:assert/strict";
import test from "node:test";

import {
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

test("existing portal members are linked to CRM before reporting existing access", async () => {
  const linked: Array<Record<string, unknown>> = [];
  const client = {
    from(table: string) {
      if (table === "organization_members") {
        return {
          select: () => queryResult({
            data: [{ profile_id: "profile-1", role: "member", profile: { email: "person@example.com" } }],
            error: null,
          }),
        };
      }
      if (table === "profiles") return { select: () => queryResult({ data: [], error: null }) };
      if (table === "organizations") return { select: () => queryResult({ data: { name: "Acme" }, error: null }) };
      if (table === "organization_invitations") {
        return {
          select: () => queryResult({ data: [], error: null }),
          update: () => queryResult({ data: [], error: null }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };

  const result = await inviteOrganizationMembers(
    client as never,
    "org-1",
    [{ email: "Person@Example.com", role: "member" }],
    "actor-1",
    {
      ensureCrmContactForProfile: async (profileId, options) => {
        linked.push({ profileId, organizationId: options.organizationId, source: options.source });
        return { success: true, contactId: "contact-1" };
      },
    },
  );

  assert.deepEqual(linked, [{
    profileId: "profile-1",
    organizationId: "org-1",
    source: "organization_member_direct_access",
  }]);
  assert.deepEqual(result.outcomes, [{
    email: "person@example.com",
    role: "member",
    status: "already_member",
    profileId: "profile-1",
  }]);
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

test("a membership write failure is returned as a per-person API outcome", async () => {
  const client = {
    from(table: string) {
      if (table === "organization_members") {
        return {
          select: () => queryResult({ data: [], error: null }),
          upsert: () => queryResult({ data: null, error: { message: "write failed" } }),
        };
      }
      if (table === "profiles") return { select: () => queryResult({ data: [{ id: "profile-1", email: "person@example.com" }], error: null }) };
      if (table === "organizations") return { select: () => queryResult({ data: { name: "Acme" }, error: null }) };
      if (table === "organization_invitations") return { select: () => queryResult({ data: [], error: null }) };
      throw new Error(`unexpected table ${table}`);
    },
  };

  const result = await inviteOrganizationMembers(
    client as never,
    "org-1",
    [{ email: "person@example.com", role: "member" }],
    "actor-1",
    { ensureCrmContactForProfile: async () => ({ success: true, contactId: "contact-1" }) },
  );

  assert.equal(result.outcomes[0]?.status, "api_failed");
  assert.match(result.outcomes[0]?.message ?? "", /conceder o acesso/);
  assert.equal(result.summary.failedApiOperations, 1);
  assert.equal(result.summary.failedContactLinks, 0);
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
