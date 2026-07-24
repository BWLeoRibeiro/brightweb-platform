import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createInvitationAcceptHandler,
  createInvitationRegisterHandler,
} from "../packages/core-auth/src/invitations.ts";
import {
  createAdminUserInvitationDeleteHandler,
  createAdminUserInvitationsHandler,
} from "../packages/module-admin/src/http.ts";
import { createOrganization } from "../packages/module-orgs/src/data.ts";
import {
  createOrganizationInvitationsHandler,
  createOrganizationsPostHandler,
} from "../packages/module-orgs/src/http.ts";
import { createCrmUiClient } from "../packages/module-crm/src/ui/client.ts";

test("organization writes use MQ field normalization and preserve ownership fields", async () => {
  let inserted: Record<string, unknown> | null = null;
  const row = {
    id: "org-1",
    name: "Acme",
    industry: null,
    company_size: null,
    budget_range: null,
    website_url: null,
    address: "Rua 1 · Lisboa",
    tax_identifier_value: "123456789",
    tax_identifier_kind: "vat",
    tax_identifier_country_code: "PT",
    primary_contact_id: "profile-1",
    primary_contact: null,
    created_at: "2026-07-24T00:00:00.000Z",
  };
  const supabase = {
    from(table: string) {
      assert.equal(table, "organizations");
      return {
        insert(payload: Record<string, unknown>) { inserted = payload; return this; },
        select() { return this; },
        async single() { return { data: row, error: null }; },
      };
    },
  };
  await createOrganization(supabase as never, {
    name: " Acme ",
    addressLine1: " Rua 1 ",
    country: " Lisboa ",
    taxIdentifierValue: "PT 123 456 789",
    primaryContactId: "profile-1",
  });
  assert.deepEqual(inserted, {
    name: "Acme",
    industry: null,
    company_size: null,
    budget_range: null,
    website_url: null,
    address: "Rua 1 · Lisboa",
    tax_identifier_value: "123456789",
    tax_identifier_kind: "vat",
    tax_identifier_country_code: "PT",
    primary_contact_id: "profile-1",
  });
});

test("organization create and invitation handlers authorize before service-role writes", async () => {
  let createdInput: Record<string, unknown> | null = null;
  let invited: unknown[] | null = null;
  const dependencies = {
    getCreateAccess: async () => ({ ok: true as const, serviceSupabase: {} as never, profileId: "profile-1" }),
    getManageAccess: async () => ({ ok: true as const, serviceSupabase: {} as never, profileId: "profile-1" }),
    createOrganization: async (_client: never, input: Record<string, unknown>) => {
      createdInput = input;
      return { id: "org-1", name: input.name };
    },
    updateOrganization: async () => ({ id: "org-1" }),
    inviteMembers: async (_client: never, _orgId: string, drafts: unknown[]) => {
      invited = drafts;
      return { invitations: [], summary: { pendingInvitations: drafts.length } };
    },
    logActivity: async () => {},
  };
  const response = await createOrganizationsPostHandler(dependencies as never)(new Request("https://example.test/api/organizations", {
    method: "POST",
    body: JSON.stringify({
      name: " Acme ",
      companySize: "10-50",
      addressLine1: "Rua 1",
      invitations: [{ email: " Person@Example.com ", role: "admin" }],
    }),
  }));
  assert.equal(response.status, 201);
  assert.equal(createdInput?.name, "Acme");
  assert.deepEqual(invited, [{ email: "person@example.com", role: "admin" }]);

  let listCalled = false;
  const invitationHandlers = createOrganizationInvitationsHandler({
    getManageAccess: async () => ({ ok: false as const, status: 403, error: "Acesso proibido." }),
    inviteMembers: async () => { throw new Error("must not run"); },
    listInvitations: async () => { listCalled = true; return []; },
    listMembers: async () => [],
    revokeInvitation: async () => {},
    logActivity: async () => {},
  } as never);
  const denied = await invitationHandlers.GET(
    new Request("https://example.test"),
    { params: Promise.resolve({ id: "org-1" }) },
  );
  assert.equal(denied.status, 403);
  assert.equal(listCalled, false);
});

test("admin invitation handlers enforce admin access and preserve response envelopes", async () => {
  const created: Array<Record<string, unknown>> = [];
  const handlers = createAdminUserInvitationsHandler({
    getAccess: async () => ({ ok: true as const, profileId: "admin-profile" }),
    getServiceClient: () => ({}),
    listInvitations: async () => [{ id: "invite-1" }],
    createInvitation: async (_client: never, input: Record<string, unknown>) => {
      created.push(input);
      return { id: "invite-2", ...input };
    },
    revokeInvitation: async () => {},
  } as never);
  assert.deepEqual(await (await handlers.GET()).json(), { data: [{ id: "invite-1" }] });
  const response = await handlers.POST(new Request("https://example.test", {
    method: "POST",
    body: JSON.stringify({ email: "person@example.com", role: "staff" }),
  }));
  assert.equal(response.status, 201);
  assert.equal(created[0]?.invitedByProfileId, "admin-profile");

  let revoked = "";
  const deleteHandler = createAdminUserInvitationDeleteHandler({
    getAccess: async () => ({ ok: true as const, profileId: "admin-profile" }),
    getServiceClient: () => ({}),
    listInvitations: async () => [],
    createInvitation: async () => ({}),
    revokeInvitation: async (_client: never, id: string) => { revoked = id; },
  } as never);
  await deleteHandler(new Request("https://example.test"), {
    params: Promise.resolve({ invitationId: "invite-3" }),
  });
  assert.equal(revoked, "invite-3");
});

test("invitation registration rejects malformed JSON before privileged dependencies", async () => {
  let serviceClientCalls = 0;
  let registerCalls = 0;
  const dependencies = {
    getServiceClient: () => { serviceClientCalls += 1; return {}; },
    getAccess: async () => ({ ok: false as const, status: 401, error: "Não autorizado." }),
    getOrganizationInvitation: async () => null,
    getAdminInvitation: async () => null,
    registerOrganizationInvitation: async () => { registerCalls += 1; return { email: "", organizationId: "" }; },
    registerAdminInvitation: async () => { registerCalls += 1; return { email: "", role: "staff" }; },
    acceptOrganizationInvitation: async () => ({ organizationId: "" }),
  };
  const handler = createInvitationRegisterHandler(dependencies);
  for (const body of ["{", "null", "[]"]) {
    const response = await handler(new Request("https://example.test", { method: "POST", body }), {
      params: Promise.resolve({ invitationId: "invite-1" }),
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: { code: "INVALID_PAYLOAD", message: "Payload inválido." },
    });
  }
  assert.equal(serviceClientCalls, 0);
  assert.equal(registerCalls, 0);
});

test("invitation acceptance derives identity on the server instead of trusting request data", async () => {
  let accepted: Record<string, unknown> | null = null;
  const handler = createInvitationAcceptHandler({
    getServiceClient: () => ({}),
    getAccess: async () => ({
      ok: true as const,
      profileId: "server-profile",
      user: { email: "server@example.com" },
    }),
    getOrganizationInvitation: async () => null,
    getAdminInvitation: async () => null,
    registerOrganizationInvitation: async () => ({ email: "", organizationId: "" }),
    registerAdminInvitation: async () => ({ email: "", role: "staff" }),
    acceptOrganizationInvitation: async (_client: never, input: Record<string, unknown>) => {
      accepted = input;
      return { organizationId: "org-1" };
    },
  });
  const response = await handler(new Request("https://example.test", {
    method: "POST",
    body: JSON.stringify({ profileId: "attacker", email: "attacker@example.com" }),
  }), { params: Promise.resolve({ invitationId: "invite-1" }) });
  assert.equal(response.status, 200);
  assert.deepEqual(accepted, {
    invitationId: "invite-1",
    profileId: "server-profile",
    userEmail: "server@example.com",
  });
});

test("CRM client maps its organization form contract to the MQ organization API", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = async (input: URL | RequestInfo, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({
      data: { organization: { id: "org-1", name: "Acme", address: "Rua 1" } },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const client = createCrmUiClient("/api/crm", fetcher as typeof fetch);
  const created = await client.createOrganization({
    name: "Acme",
    company_size: "10-50",
    address: "Rua 1",
    taxIdentifierValue: "123",
  });
  assert.equal(created.id, "org-1");
  assert.equal(calls[0]?.url, "/api/organizations");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    name: "Acme",
    companySize: "10-50",
    addressLine1: "Rua 1",
    taxIdentifierValue: "123",
  });
});

test("canonical and scaffold invitation migrations remain identical", async () => {
  const canonical = await readFile("supabase/modules/admin/migrations/20260724121000_admin_user_invitations.sql", "utf8");
  const scaffold = await readFile(
    "packages/create-bw-app/template/supabase/modules/admin/migrations/20260724121000_admin_user_invitations.sql",
    "utf8",
  );
  assert.equal(canonical, scaffold);
  assert.match(canonical, /role_code IN \('staff', 'admin'\)/);
  assert.match(canonical, /status = 'pending'/);
  assert.match(canonical, /public\.is_admin\(\)/);
});
