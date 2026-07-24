import assert from "node:assert/strict";
import test from "node:test";

import { MAX_BULK_OPERATION_IDS, validateBoundedUuidBatch } from "../packages/infra/src/robustness.ts";
import {
  createAdminUsersGetHandler,
  createAdminUsersRoleChangeHandler,
} from "../packages/module-admin/src/http.ts";
import { applyAdminRoleChanges } from "../packages/module-admin/src/roles.ts";
import { createAdminUiClient } from "../packages/module-admin/src/ui/client.ts";
import {
  createCrmContactsDeleteHandler,
  createCrmContactsGetHandler,
  createCrmContactsPostHandler,
  createCrmOwnersGetHandler,
  parseCrmTimelineRequest,
} from "../packages/module-crm/src/http.ts";
import { createCrmUiClient } from "../packages/module-crm/src/ui/client.ts";
import { listCrmStatusTimeline } from "../packages/module-crm/src/data.ts";

const uuid = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;

function crmDependencies(overrides: Record<string, unknown> = {}) {
  return {
    getAccess: async () => ({ ok: true as const, supabase: {}, profileId: uuid(99), role: "admin" }),
    listContacts: async () => ({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 }),
    listOrganizations: async () => ({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 }),
    getStats: async () => ({ total: 0, byStatus: {} }),
    listOwners: async () => [],
    listTimeline: async () => [],
    getReport: async () => ({}),
    createContact: async () => ({}),
    updateContact: async () => ({}),
    setContactStatus: async () => [],
    deleteContact: async (_supabase: never, id: string) => ({ deletedId: id }),
    ...overrides,
  };
}

test("CRM and Admin clients accept handler fixtures and reject malformed successful payloads", async () => {
  const crmHandler = createCrmContactsGetHandler(crmDependencies() as never);
  const crmClient = createCrmUiClient("/api/crm", (async () => crmHandler(
    new Request("https://example.test/api/crm/contacts"),
  )) as typeof fetch);
  assert.deepEqual(await crmClient.listContacts({ page: 1, pageSize: 20 }), {
    items: [], page: 1, pageSize: 20, total: 0, totalPages: 1,
  });

  const adminHandler = createAdminUsersGetHandler({
    getAccess: async () => ({ ok: true as const, supabase: {} }),
    listUsers: async () => ({ data: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 } }),
    applyRoleChanges: async () => ({ changed: [], skipped: [], summary: { requested: 0, changed: 0, skipped: 0 } }),
  });
  const adminClient = createAdminUiClient("/api/admin/users", (async () => adminHandler(
    new Request("https://example.test/api/admin/users"),
  )) as typeof fetch);
  assert.deepEqual(await adminClient.listUsers({ page: 1, pageSize: 10 }), {
    data: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 },
  });

  const malformedCrm = createCrmUiClient("/api/crm", (async () => new Response(JSON.stringify({
    items: [{ id: uuid(1) }],
    page: 1,
    pageSize: 20,
    total: 1,
    totalPages: 1,
  }))) as typeof fetch);
  await assert.rejects(malformedCrm.listContacts({ page: 1, pageSize: 20 }), /Invalid CRM contact response/);

  const malformedAdmin = createAdminUiClient("/api/admin/users", (async () => new Response(JSON.stringify({
    data: [{
      profileId: uuid(1),
      name: "Ada",
      email: "ada@example.com",
      role: "owner",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: null,
    }],
    pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
  }))) as typeof fetch);
  await assert.rejects(malformedAdmin.listUsers({ page: 1, pageSize: 10 }), /Invalid admin user response/);
});

test("public errors preserve domain failures and hide infrastructure details", async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const duplicate = await createCrmContactsPostHandler(crmDependencies({
      createContact: async () => { throw new Error("A CRM contact with this email already exists."); },
    }) as never)(new Request("https://example.test/api/crm/contacts", {
      method: "POST",
      body: JSON.stringify({ email: "ada@example.com" }),
    }));
    assert.equal(duplicate.status, 409);
    assert.deepEqual(await duplicate.json(), {
      error: {
        code: "DUPLICATE_EMAIL",
        message: "A CRM contact with this email already exists.",
      },
    });

    const crmInfra = await createCrmOwnersGetHandler(crmDependencies({
      listOwners: async () => { throw new Error("postgres://private-host leaked"); },
    }) as never)(new Request("https://example.test/api/crm/owners"));
    assert.equal(crmInfra.status, 500);
    const crmPayload = await crmInfra.json();
    assert.equal(crmPayload.error.code, "INTERNAL_ERROR");
    assert.doesNotMatch(crmPayload.error.message, /private-host/);

    const adminInfra = await createAdminUsersGetHandler({
      getAccess: async () => ({ ok: true as const, supabase: {} }),
      listUsers: async () => { throw new Error("provider secret details"); },
      applyRoleChanges: async () => ({ changed: [], skipped: [], summary: { requested: 0, changed: 0, skipped: 0 } }),
    })(new Request("https://example.test/api/admin/users"));
    const adminPayload = await adminInfra.json();
    assert.equal(adminPayload.error.code, "INTERNAL_ERROR");
    assert.doesNotMatch(adminPayload.error.message, /secret/);
  } finally {
    console.error = originalError;
  }
});

test("shared UUID batches are capped and CRM bulk deletes return explicit partial outcomes", async () => {
  assert.deepEqual(validateBoundedUuidBatch(Array.from({ length: MAX_BULK_OPERATION_IDS + 1 }, (_, index) => uuid(index + 1))), {
    ok: false,
    code: "BATCH_TOO_LARGE",
  });
  assert.deepEqual(validateBoundedUuidBatch([uuid(1), "not-a-uuid"]), {
    ok: false,
    code: "INVALID_UUID",
    invalidIds: ["not-a-uuid"],
  });
  assert.deepEqual(validateBoundedUuidBatch([uuid(1), 2]), {
    ok: false,
    code: "INVALID_UUID",
    invalidIds: [],
  });

  const handler = createCrmContactsDeleteHandler(crmDependencies({
    deleteContact: async (_supabase: never, id: string) => {
      if (id === uuid(2)) throw new Error("provider delete failed");
      return { deletedId: id };
    },
  }) as never);
  const originalError = console.error;
  console.error = () => {};
  try {
    const response = await handler(new Request("https://example.test/api/crm/contacts", {
      method: "DELETE",
      body: JSON.stringify({ contactIds: [uuid(1), uuid(2), uuid(3)] }),
    }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      data: {
        outcomes: [
          { id: uuid(1), ok: true },
          { id: uuid(2), ok: false, code: "WRITE_FAILED" },
          { id: uuid(3), ok: true },
        ],
        summary: { requested: 3, succeeded: 2, failed: 1 },
      },
    });
  } finally {
    console.error = originalError;
  }
});

test("Admin role changes reject oversized/invalid batches and sanitize per-ID provider failures", async () => {
  let applyCalls = 0;
  const handler = createAdminUsersRoleChangeHandler({
    getAccess: async () => ({ ok: true as const, supabase: {} }),
    listUsers: async () => ({ data: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 } }),
    applyRoleChanges: async () => {
      applyCalls += 1;
      return { changed: [], skipped: [], summary: { requested: 0, changed: 0, skipped: 0 } };
    },
  });
  const oversized = await handler(new Request("https://example.test/api/admin/users/roles", {
    method: "POST",
    body: JSON.stringify({
      profileIds: Array.from({ length: MAX_BULK_OPERATION_IDS + 1 }, (_, index) => uuid(index + 1)),
      newRole: "staff",
      reason: "coverage",
    }),
  }));
  assert.equal(oversized.status, 400);
  assert.equal((await oversized.json()).error.code, "BATCH_TOO_LARGE");
  assert.equal(applyCalls, 0);

  const supabase = {
    async rpc() {
      return { data: null, error: { message: "private database topology" } };
    },
  };
  const originalError = console.error;
  console.error = () => {};
  try {
    const result = await applyAdminRoleChanges({
      supabase: supabase as never,
      profileIds: [uuid(1)],
      newRole: "staff",
      reason: "coverage",
    });
    assert.deepEqual(result.skipped, [{ profileId: uuid(1), reason: "role_update_failed" }]);
  } finally {
    console.error = originalError;
  }
});

test("CRM timeline request limits and timestamps are bounded before data access", async () => {
  const parsed = parseCrmTimelineRequest(
    "https://example.test/api/crm/timeline?limit=999999&since=not-a-date",
  );
  assert.equal(parsed.limit, 100);
  assert.equal(parsed.since, undefined);

  let receivedSince = "";
  let receivedLimit = 0;
  const query = {
    select() { return this; },
    gte(_column: string, value: string) { receivedSince = value; return this; },
    order() { return this; },
    limit(value: number) {
      receivedLimit = value;
      return Promise.resolve({ data: [], error: null });
    },
  };
  const supabase = { from: () => query };
  await listCrmStatusTimeline(supabase as never, {
    limit: 10_000,
    since: "1970-01-01T00:00:00.000Z",
  });
  assert.equal(receivedLimit, 100);
  const earliestAllowed = Date.now() - 366 * 86_400_000;
  assert.ok(new Date(receivedSince).getTime() >= earliestAllowed);
});
