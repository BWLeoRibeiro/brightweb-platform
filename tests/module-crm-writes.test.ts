import assert from "node:assert/strict";
import test from "node:test";
import {
  bulkSetCrmContactStatus,
  createCrmContact,
  setCrmContactStatus,
  updateCrmContact,
} from "../packages/module-crm/src/server.ts";
import {
  createCrmContactsPatchHandler,
  createCrmContactsPostHandler,
} from "../packages/module-crm/src/http.ts";

type ContactRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  source: string | null;
  owner_id: string | null;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
  organizations: null;
};

function contact(id: string, status = "lead"): ContactRow {
  return {
    id,
    first_name: "Ada",
    last_name: "Lovelace",
    email: `${id}@example.com`,
    phone: null,
    status,
    source: "manual",
    owner_id: "owner-1",
    organization_id: null,
    created_at: "2026-07-20T10:00:00.000Z",
    updated_at: "2026-07-20T10:00:00.000Z",
    organizations: null,
  };
}

function createStatusSupabase(initialRows: ContactRow[]) {
  const rows = new Map(initialRows.map((row) => [row.id, row]));
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

  const supabase = {
    from(table: string) {
      assert.equal(table, "crm_contacts");
      let selectedId = "";
      return {
        select() { return this; },
        eq(field: string, value: string) {
          assert.equal(field, "id");
          selectedId = value;
          return this;
        },
        async maybeSingle() {
          return { data: rows.get(selectedId) ?? null, error: null };
        },
      };
    },
    async rpc(name: string, args: Record<string, unknown>) {
      rpcCalls.push({ name, args });
      const id = String(args.p_contact_id);
      const row = rows.get(id);
      if (row) rows.set(id, { ...row, status: String(args.p_new_status) });
      return { data: null, error: null };
    },
  };

  return { supabase, rpcCalls };
}

test("CRM create and update reject invalid input before querying Supabase", async () => {
  const supabase = {
    from() {
      throw new Error("Supabase must not be queried for invalid input.");
    },
  };

  await assert.rejects(
    createCrmContact(supabase as never, { firstName: "", lastName: "", email: "" }),
    /first name, last name, or email is required/i,
  );
  await assert.rejects(
    updateCrmContact(supabase as never, "contact-1", { email: "not-an-email" }),
    /invalid email address/i,
  );
});

test("setCrmContactStatus calls the SQL history RPC with the exact contract", async () => {
  const { supabase, rpcCalls } = createStatusSupabase([contact("contact-1")]);
  const result = await setCrmContactStatus(
    supabase as never,
    "contact-1",
    "qualified",
    "Discovery completed",
  );

  assert.equal(result.status, "qualified");
  assert.deepEqual(rpcCalls, [{
    name: "set_crm_status",
    args: {
      p_contact_id: "contact-1",
      p_new_status: "qualified",
      p_reason: "Discovery completed",
    },
  }]);
});

test("bulkSetCrmContactStatus applies the RPC once per distinct contact", async () => {
  const { supabase, rpcCalls } = createStatusSupabase([
    contact("contact-1"),
    contact("contact-2", "proposal"),
  ]);

  const result = await bulkSetCrmContactStatus(
    supabase as never,
    ["contact-1", "contact-2", "contact-1"],
    "won",
  );

  assert.deepEqual(result.map((row) => row.status), ["won", "won"]);
  assert.deepEqual(rpcCalls.map((call) => call.name), ["set_crm_status", "set_crm_status"]);
  assert.deepEqual(rpcCalls.map((call) => call.args.p_contact_id).sort(), ["contact-1", "contact-2"]);
});

test("CRM POST and PATCH handlers reject non-staff access before writes", async () => {
  let writeCalls = 0;
  const dependencies = {
    getAccess: async () => ({
      ok: true as const,
      supabase: {},
      profileId: "profile-1",
      role: "client",
    }),
    listContacts: async () => { throw new Error("unused"); },
    listOrganizations: async () => { throw new Error("unused"); },
    getStats: async () => { throw new Error("unused"); },
    listOwners: async () => { throw new Error("unused"); },
    createContact: async () => { writeCalls += 1; return contact("created"); },
    updateContact: async () => { writeCalls += 1; return contact("updated"); },
    setContactStatus: async () => { writeCalls += 1; return []; },
  };

  const post = createCrmContactsPostHandler(dependencies as never);
  const patch = createCrmContactsPatchHandler(dependencies as never);
  const [postResponse, patchResponse] = await Promise.all([
    post(new Request("http://localhost/api/crm/contacts", {
      method: "POST",
      body: JSON.stringify({ email: "ada@example.com" }),
    })),
    patch(new Request("http://localhost/api/crm/contacts", {
      method: "PATCH",
      body: JSON.stringify({ contactId: "contact-1", status: "won" }),
    })),
  ]);

  assert.equal(postResponse.status, 403);
  assert.equal(patchResponse.status, 403);
  assert.equal(writeCalls, 0);
});
