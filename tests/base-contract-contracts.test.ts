import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  createAdminUsersGetHandler,
  createAdminUsersRoleChangeHandler,
  parseAdminRoleChangePayload,
  parseAdminUsersListRequest,
} from "../packages/module-admin/src/http.ts";
import { listAdminUsers } from "../packages/module-admin/src/users-data.ts";
import {
  getProjectPortfolioStats,
  listProjects,
} from "../packages/module-projects/src/data.ts";
import {
  createCrmContactsGetHandler,
  createCrmOrganizationsGetHandler,
  createCrmOwnersGetHandler,
  createCrmStatsGetHandler,
  parseCrmContactsRequest,
  parseCrmOrganizationsRequest,
} from "../packages/module-crm/src/http.ts";
import {
  getCrmContactStatusStats,
  listCrmContacts,
  listCrmOrganizations,
  listCrmOwnerOptions,
  listCrmPrimaryContacts,
  listCrmStatusTimeline,
} from "../packages/module-crm/src/data.ts";

type Row = Record<string, unknown>;
type TableMap = Record<string, Row[]>;
type SelectError = { message: string };
type SelectErrorFactory = (context: { table: string; columns: string }) => SelectError | null;
type SelectOptions = { count?: string; head?: boolean };
type SelectSpy = (context: { table: string; columns: string; options?: SelectOptions }) => void;
type FakeSupabaseOptions = {
  selectErrorFactory?: SelectErrorFactory;
  selectSpy?: SelectSpy;
  defaultSelectLimit?: number;
};

class FakeSupabase {
  private readonly tables: TableMap;
  private readonly options: FakeSupabaseOptions;

  constructor(tables: TableMap, options: FakeSupabaseOptions = {}) {
    this.tables = tables;
    this.options = options;
  }

  from(table: string) {
    return new FakeQuery(table, this.tables[table] ?? [], this.options);
  }
}

class FakeQuery {
  private readonly table: string;
  private readonly rows: Row[];
  private readonly options: FakeSupabaseOptions;
  private filters: Array<(row: Row) => boolean> = [];
  private orderRules: Array<{ field: string; ascending: boolean }> = [];
  private rangeStart = 0;
  private rangeEnd = Number.POSITIVE_INFINITY;
  private hasExplicitRange = false;
  private countMode: string | null = null;
  private head = false;
  private selectError: SelectError | null = null;

  constructor(table: string, rows: Row[], options: FakeSupabaseOptions) {
    this.table = table;
    this.rows = rows;
    this.options = options;
  }

  select(columns: string, options?: SelectOptions) {
    this.selectError = this.options.selectErrorFactory?.({ table: this.table, columns }) ?? null;
    this.options.selectSpy?.({ table: this.table, columns, options });
    this.countMode = options?.count ?? null;
    this.head = Boolean(options?.head);
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.orderRules.push({ field, ascending: options?.ascending !== false });
    return this;
  }

  range(from: number, to: number) {
    this.rangeStart = from;
    this.rangeEnd = to;
    this.hasExplicitRange = true;
    return this;
  }

  limit(value: number) {
    this.rangeStart = 0;
    this.rangeEnd = value - 1;
    this.hasExplicitRange = true;
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push((row) => getFieldValue(row, field) === value);
    return this;
  }

  ilike(field: string, pattern: string) {
    const matcher = patternToNeedle(pattern);
    this.filters.push((row) => String(getFieldValue(row, field) ?? "").toLowerCase().includes(matcher));
    return this;
  }

  not(field: string, operator: string, value: string) {
    if (operator === "in") {
      const excluded = value
        .slice(1, -1)
        .split(",")
        .map((item) => item.trim());
      this.filters.push((row) => !excluded.includes(String(getFieldValue(row, field) ?? "")));
    }
    return this;
  }

  in(field: string, values: unknown[]) {
    this.filters.push((row) => values.includes(getFieldValue(row, field)));
    return this;
  }

  lt(field: string, value: string) {
    this.filters.push((row) => String(getFieldValue(row, field) ?? "") < value);
    return this;
  }

  gte(field: string, value: string) {
    this.filters.push((row) => String(getFieldValue(row, field) ?? "") >= value);
    return this;
  }

  lte(field: string, value: string) {
    this.filters.push((row) => String(getFieldValue(row, field) ?? "") <= value);
    return this;
  }

  or(expression: string, options?: { foreignTable?: string }) {
    const clauses = expression.split(",").map((clause) => clause.trim()).filter(Boolean);
    this.filters.push((row) => clauses.some((clause) => evaluateClause(row, clause, options?.foreignTable)));
    return this;
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[] | null; error: SelectError | null; count: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private execute() {
    if (this.selectError) {
      return {
        data: null,
        error: this.selectError,
        count: null,
      };
    }

    let data = [...this.rows];

    for (const filter of this.filters) {
      data = data.filter(filter);
    }

    const count = this.countMode ? data.length : null;

    for (const rule of [...this.orderRules].reverse()) {
      data.sort((left, right) => compareValues(getFieldValue(left, rule.field), getFieldValue(right, rule.field), rule.ascending));
    }

    const effectiveRangeEnd = this.hasExplicitRange
      ? this.rangeEnd
      : this.options.defaultSelectLimit === undefined
        ? this.rangeEnd
        : this.options.defaultSelectLimit - 1;

    data = data.slice(this.rangeStart, Number.isFinite(effectiveRangeEnd) ? effectiveRangeEnd + 1 : undefined);

    return {
      data: this.head ? null : data,
      error: null,
      count,
    };
  }
}

function getFieldValue(row: Row, field: string) {
  return field.split(".").reduce<unknown>((current, part) => {
    if (Array.isArray(current)) {
      current = current[0] ?? null;
    }
    if (typeof current !== "object" || current === null) {
      return undefined;
    }
    return (current as Row)[part];
  }, row);
}

function patternToNeedle(pattern: string) {
  return pattern.replaceAll("%", "").toLowerCase();
}

function evaluateClause(row: Row, clause: string, foreignTable?: string) {
  const match = clause.match(/^([A-Za-z0-9_]+)\.(ilike|eq)\.(.+)$/);
  if (!match) return false;

  const [, field, operator, rawValue] = match;
  const target = foreignTable === "profiles" ? normalizeProfile(getFieldValue(row, "profile")) : row;
  const value = getFieldValue(target ?? row, field);

  if (operator === "eq") {
    return String(value ?? "") === rawValue;
  }

  return String(value ?? "").toLowerCase().includes(patternToNeedle(rawValue));
}

function normalizeProfile(value: unknown) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return typeof value === "object" && value !== null ? (value as Row) : null;
}

function compareValues(left: unknown, right: unknown, ascending: boolean) {
  const direction = ascending ? 1 : -1;
  if (left === right) return 0;
  if (left == null) return 1 * direction;
  if (right == null) return -1 * direction;
  return String(left).localeCompare(String(right)) * direction;
}

function createAdminSupabase() {
  return new FakeSupabase({
    user_role_assignments: [
      {
        profile_id: "profile-1",
        role_code: "admin",
        assigned_at: "2026-03-05T10:00:00.000Z",
        profile: {
          id: "profile-1",
          email: "ana@example.com",
          first_name: "Ana",
          last_name: "Costa",
          created_at: "2026-01-01T10:00:00.000Z",
          updated_at: "2026-03-01T12:00:00.000Z",
        },
      },
      {
        profile_id: "profile-2",
        role_code: "staff",
        assigned_at: "2026-03-04T10:00:00.000Z",
        profile: {
          id: "profile-2",
          email: "bruno@example.com",
          first_name: "Bruno",
          last_name: "Santos",
          created_at: "2026-01-10T10:00:00.000Z",
          updated_at: null,
        },
      },
      {
        profile_id: "profile-3",
        role_code: "client",
        assigned_at: "2026-03-03T10:00:00.000Z",
        profile: {
          id: "profile-3",
          email: "carla@example.com",
          first_name: "Carla",
          last_name: "Matos",
          created_at: "2026-01-12T10:00:00.000Z",
          updated_at: "2026-03-02T12:00:00.000Z",
        },
      },
    ],
  });
}

test("infra supabase clients validate env lazily and keep legacy aliases as fallback", async (t) => {
  const originalEnv = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SECRET_DEFAULT_KEY: process.env.SUPABASE_SECRET_DEFAULT_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  t.after(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_SECRET_DEFAULT_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  const envModule = await import("../packages/infra/src/supabase-env.ts");
  const clientModule = await import("../packages/infra/src/client.ts");

  assert.equal(envModule.resolveSupabaseServiceRoleKey(), null);
  assert.throws(() => clientModule.createClient(), /Variáveis de ambiente do Supabase em falta/);

  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_legacy";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_legacy";

  assert.deepEqual(envModule.resolveSupabasePublicEnv(), {
    supabaseUrl: "https://example.supabase.co",
    supabasePublishableKey: "sb_publishable_legacy",
  });
  assert.equal(envModule.resolveSupabaseServiceRoleKey(), "sb_secret_legacy");
  assert.doesNotThrow(() => clientModule.createClient());
});

test("infra resend webhook verifier accepts sha256 signatures and raw secret fallback", async (t) => {
  const originalEnv = {
    RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET,
  };

  t.after(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  process.env.RESEND_WEBHOOK_SECRET = "top-secret";

  const serverModule = await import("../packages/infra/src/server.ts");
  const body = JSON.stringify({ hello: "world" });
  const digest = createHmac("sha256", "top-secret").update(body).digest("hex");

  assert.equal(serverModule.verifyResendWebhookSignature(body, `sha256=${digest}`), true);
  assert.equal(serverModule.verifyResendWebhookSignature(body, "top-secret"), true);
  assert.equal(serverModule.verifyResendWebhookSignature(body, "sha256=bad"), false);
  assert.equal(serverModule.verifyResendWebhookSignature(body, null), false);
  assert.equal(serverModule.verifyResendWebhookSignature(body, `sha256=${digest}`, "top-secret"), true);
});

test("infra resendApiRequest throws typed config and provider errors", async (t) => {
  const originalEnv = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
  };
  const originalFetch = globalThis.fetch;

  t.after(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    globalThis.fetch = originalFetch;
  });

  const serverModule = await import("../packages/infra/src/server.ts");

  delete process.env.RESEND_API_KEY;
  await assert.rejects(
    () => serverModule.resendApiRequest("/emails", { method: "POST", body: "{}" }),
    (error) => error instanceof serverModule.ResendConfigError,
  );

  process.env.RESEND_API_KEY = "re_test";
  let capturedInit: RequestInit | undefined;
  globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedInit = init;
    return new Response(JSON.stringify({ error: "bad request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  };

  await assert.rejects(
    () => serverModule.resendApiRequest("/emails", { method: "POST", body: "{}" }),
    (error) => error instanceof serverModule.ResendApiError && error.status === 400 && error.path === "/emails",
  );

  const headers = capturedInit?.headers as Record<string, string> | undefined;
  assert.equal(headers?.Authorization, "Bearer re_test");
  assert.equal(headers?.["Content-Type"], "application/json");
});

function createCrmSupabase() {
  return new FakeSupabase({
    crm_contacts: [
      {
        id: "contact-1",
        first_name: "Ana",
        last_name: "Silva",
        email: "ana@acme.com",
        phone: "111",
        status: "lead",
        source: "manual",
        owner_id: "owner-1",
        organization_id: "org-1",
        created_at: "2026-01-05T12:00:00.000Z",
        updated_at: "2026-03-10T12:00:00.000Z",
        organizations: [{ name: "Acme Labs" }],
      },
      {
        id: "contact-2",
        first_name: "Ana Paula",
        last_name: "Rocha",
        email: "ana.paula@acme.com",
        phone: "222",
        status: "lead",
        source: "import",
        owner_id: "owner-1",
        organization_id: "org-1",
        created_at: "2026-01-10T12:00:00.000Z",
        updated_at: "2026-03-08T12:00:00.000Z",
        organizations: { name: "Acme Labs" },
      },
      {
        id: "contact-3",
        first_name: "Bruno",
        last_name: "Matos",
        email: "bruno@bright.com",
        phone: "333",
        status: "qualified",
        source: "manual",
        owner_id: "owner-2",
        organization_id: "org-2",
        created_at: "2026-01-11T12:00:00.000Z",
        updated_at: "2026-03-07T12:00:00.000Z",
        organizations: [{ name: "Bright Systems" }],
      },
    ],
    organizations: [
      {
        id: "org-1",
        name: "Acme Labs",
        industry: "SaaS",
        company_size: "11-50",
        budget_range: "medium",
        website_url: "https://acme.example.com",
        address: "Rua A",
        tax_identifier_value: "PT123",
        primary_contact_id: "contact-1",
        primary_contact: [{ id: "contact-1", first_name: "Ana", last_name: "Silva", email: "ana@acme.com" }],
        created_at: "2026-01-01T12:00:00.000Z",
      },
      {
        id: "org-2",
        name: "Bright Systems",
        industry: "Services",
        company_size: "51-200",
        budget_range: "large",
        website_url: "https://bright.example.com",
        address: "Rua B",
        tax_identifier_value: "PT456",
        primary_contact_id: "contact-3",
        primary_contact: [{ id: "contact-3", first_name: "Bruno", last_name: "Matos", email: "bruno@bright.com" }],
        created_at: "2026-01-02T12:00:00.000Z",
      },
      {
        id: "org-3",
        name: "Bright Growth",
        industry: "Agency",
        company_size: "1-10",
        budget_range: "small",
        website_url: "https://growth.example.com",
        address: "Rua C",
        tax_identifier_value: "PT789",
        primary_contact_id: null,
        primary_contact: [],
        created_at: "2026-01-03T12:00:00.000Z",
      },
    ],
    user_role_assignments: [
      {
        profile_id: "owner-1",
        role_code: "staff",
        assigned_at: "2026-03-10T10:00:00.000Z",
        profile: [{ id: "owner-1", first_name: "Sara", last_name: "Costa", email: "sara@example.com" }],
      },
      {
        profile_id: "owner-1",
        role_code: "staff",
        assigned_at: "2026-03-09T10:00:00.000Z",
        profile: [{ id: "owner-1", first_name: "Sara", last_name: "Costa", email: "sara@example.com" }],
      },
      {
        profile_id: "owner-2",
        role_code: "admin",
        assigned_at: "2026-03-08T10:00:00.000Z",
        profile: [{ id: "owner-2", first_name: "Tom", last_name: "Pires", email: "tom@example.com" }],
      },
      {
        profile_id: "owner-3",
        role_code: "client",
        assigned_at: "2026-03-07T10:00:00.000Z",
        profile: [{ id: "owner-3", first_name: "Client", last_name: "User", email: "client@example.com" }],
      },
    ],
    crm_status_log: [
      {
        id: "status-1",
        contact_id: "contact-1",
        previous_status: "lead",
        new_status: "qualified",
        reason: "Discovery complete",
        changed_at: "2026-03-10T12:00:00.000Z",
        changed_by_user_id: "user-owner-1",
      },
      {
        id: "status-2",
        contact_id: "contact-3",
        previous_status: null,
        new_status: "lead",
        reason: null,
        changed_at: "2026-03-09T12:00:00.000Z",
        changed_by_user_id: null,
      },
    ],
    profiles: [
      {
        id: "profile-1",
        user_id: "user-owner-1",
        first_name: "Sara",
        last_name: "Costa",
        email: "sara@example.com",
        created_at: "2026-03-10T10:00:00.000Z",
      },
      {
        id: "profile-2",
        user_id: "user-owner-2",
        first_name: "Tom",
        last_name: "Pires",
        email: "tom@example.com",
        created_at: "2026-03-09T10:00:00.000Z",
      },
    ],
  });
}

type CreateProjectsSupabaseOptions = {
  includePhoneData?: boolean;
  simulateMissingProfilesPhone?: boolean;
  projectSelectColumnsLog?: string[];
};

function createProjectsSupabase(options: CreateProjectsSupabaseOptions = {}) {
  const today = new Date();
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const inThreeDays = new Date(today);
  inThreeDays.setDate(today.getDate() + 3);
  const inTenDays = new Date(today);
  inTenDays.setDate(today.getDate() + 10);
  const includePhoneData = options.includePhoneData !== false;

  const primaryContact1 = includePhoneData
    ? { first_name: "Ana", last_name: "Silva", email: "ana@acme.com", phone: "111" }
    : { first_name: "Ana", last_name: "Silva", email: "ana@acme.com" };
  const primaryContact2 = includePhoneData
    ? { first_name: "Bruno", last_name: "Matos", email: "bruno@bright.com", phone: "222" }
    : { first_name: "Bruno", last_name: "Matos", email: "bruno@bright.com" };
  const owner1 = includePhoneData
    ? { first_name: "Sara", last_name: "Costa", email: "sara@example.com", phone: "911" }
    : { first_name: "Sara", last_name: "Costa", email: "sara@example.com" };
  const owner2 = includePhoneData
    ? { first_name: "Tom", last_name: "Pires", email: "tom@example.com", phone: "922" }
    : { first_name: "Tom", last_name: "Pires", email: "tom@example.com" };
  const owner3 = includePhoneData
    ? { first_name: "Eva", last_name: "Melo", email: "eva@example.com", phone: "933" }
    : { first_name: "Eva", last_name: "Melo", email: "eva@example.com" };

  return new FakeSupabase({
    projects: [
      {
        id: "project-1",
        organization_id: "org-1",
        name: "Alpha Rollout",
        code: "ALP",
        status: "active",
        health: "on_track",
        owner_profile_id: "owner-1",
        activated_at: iso(today),
        target_date: iso(inThreeDays),
        completed_at: null,
        cancellation_reason: null,
        summary: "Main rollout",
        created_at: "2026-01-01T12:00:00.000Z",
        updated_at: "2026-03-10T12:00:00.000Z",
        organizations: [{ name: "Acme Labs", primary_contact: [primaryContact1] }],
        owner: [owner1],
      },
      {
        id: "project-2",
        organization_id: "org-2",
        name: "Beta Migration",
        code: "BET",
        status: "planned",
        health: "on_track",
        owner_profile_id: "owner-2",
        activated_at: null,
        target_date: iso(inTenDays),
        completed_at: null,
        cancellation_reason: null,
        summary: "Migration prep",
        created_at: "2026-01-02T12:00:00.000Z",
        updated_at: "2026-03-09T12:00:00.000Z",
        organizations: [{ name: "Bright Systems", primary_contact: [primaryContact2] }],
        owner: [owner2],
      },
      {
        id: "project-3",
        organization_id: "org-3",
        name: "Gamma Rescue",
        code: "GAM",
        status: "active",
        health: "at_risk",
        owner_profile_id: "owner-2",
        activated_at: iso(today),
        target_date: iso(yesterday),
        completed_at: null,
        cancellation_reason: null,
        summary: "Recovery",
        created_at: "2026-01-03T12:00:00.000Z",
        updated_at: "2026-03-08T12:00:00.000Z",
        organizations: [{ name: "Bright Growth", primary_contact: [] }],
        owner: [owner2],
      },
      {
        id: "project-4",
        organization_id: "org-4",
        name: "Completed Archive",
        code: "CMP",
        status: "completed",
        health: "on_track",
        owner_profile_id: "owner-3",
        activated_at: iso(today),
        target_date: iso(yesterday),
        completed_at: iso(today),
        cancellation_reason: null,
        summary: "Done",
        created_at: "2026-01-04T12:00:00.000Z",
        updated_at: "2026-03-07T12:00:00.000Z",
        organizations: [{ name: "Archive Org", primary_contact: [] }],
        owner: [owner3],
      },
    ],
    project_tasks: [
      { project_id: "project-1", status: "todo", due_date: iso(yesterday) },
      { project_id: "project-1", status: "blocked", due_date: iso(inThreeDays) },
      { project_id: "project-1", status: "done", due_date: iso(today) },
      { project_id: "project-3", status: "todo", due_date: iso(yesterday) },
    ],
    project_milestones: [
      { project_id: "project-1", status: "achieved" },
      { project_id: "project-1", status: "delayed" },
      { project_id: "project-3", status: "delayed" },
    ],
  }, {
    selectErrorFactory: ({ table, columns }) => {
      if (!options.simulateMissingProfilesPhone) return null;
      if (table === "projects" && columns.includes("phone")) {
        return { message: "column profiles_2.phone does not exist" };
      }
      return null;
    },
    selectSpy: ({ table, columns }) => {
      if (table === "projects") options.projectSelectColumnsLog?.push(columns);
    },
  });
}

test("listAdminUsers applies search, role filtering, and pagination", async () => {
  const result = await listAdminUsers({
    supabase: createAdminSupabase() as never,
    search: "ana",
    roleFilter: "admin",
    page: 1,
    pageSize: 10,
  });

  assert.equal(result.data.length, 1);
  assert.equal(result.data[0]?.profileId, "profile-1");
  assert.equal(result.pagination.total, 1);
  assert.equal(result.pagination.totalPages, 1);
});

test("admin handler helpers parse requests and return JSON envelopes", async () => {
  assert.deepEqual(
    parseAdminUsersListRequest("https://example.com/api/admin/users?page=2&pageSize=999&search= ana &role=staff"),
    { page: 2, pageSize: 100, search: "ana", roleFilter: "staff" },
  );

  assert.deepEqual(
    parseAdminRoleChangePayload({ profileIds: ["one", "", 2], newRole: "admin", reason: " promote " }),
    { profileIds: ["one"], newRole: "admin", reason: "promote" },
  );

  const getHandler = createAdminUsersGetHandler({
    getAccess: async () => ({ ok: true, supabase: {} }),
    listUsers: async (_params) => ({ data: [], pagination: { page: 2, pageSize: 10, total: 0, totalPages: 1 } }),
    applyRoleChanges: async () => ({ changed: [], skipped: [], summary: { requested: 0, changed: 0, skipped: 0 } }),
  });
  const getResponse = await getHandler(new Request("https://example.com/api/admin/users?page=2"));
  assert.equal(getResponse.status, 200);
  assert.deepEqual(await getResponse.json(), {
    data: [],
    pagination: { page: 2, pageSize: 10, total: 0, totalPages: 1 },
  });

  const roleChangeHandler = createAdminUsersRoleChangeHandler({
    getAccess: async () => ({ ok: true, supabase: {} }),
    listUsers: async () => ({ data: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 } }),
    applyRoleChanges: async () => ({ changed: [], skipped: [], summary: { requested: 1, changed: 0, skipped: 1 } }),
  });
  const roleChangeResponse = await roleChangeHandler(
    new Request("https://example.com/api/admin/users/roles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profileIds: ["profile-1"], newRole: "staff", reason: "coverage" }),
    }),
  );
  assert.equal(roleChangeResponse.status, 200);
  assert.deepEqual(await roleChangeResponse.json(), {
    changed: [],
    skipped: [],
    summary: { requested: 1, changed: 0, skipped: 1 },
  });
});

test("listProjects and getProjectPortfolioStats preserve stable project behavior", async () => {
  const supabase = createProjectsSupabase();
  const stats = await getProjectPortfolioStats(supabase as never);
  assert.deepEqual(stats, {
    total: 3,
    planned: 1,
    active: 2,
    atRisk: 1,
    overdue: 1,
  });

  const result = await listProjects(supabase as never, {
    search: "Alpha",
    page: 1,
    pageSize: 10,
    dueWindow: "all",
  });

  assert.equal(result.total, 1);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]?.id, "project-1");
  assert.equal(result.items[0]?.organizationOwnerPhone, "111");
  assert.equal(result.items[0]?.ownerPhone, "911");
  assert.deepEqual(result.items[0]?.taskStats, { total: 3, done: 1, overdue: 1, blocked: 1 });
  assert.deepEqual(result.items[0]?.milestoneStats, { total: 2, achieved: 1, delayed: 1 });
  assert.equal(result.items[0]?.health, "at_risk");
});

test("listProjects retries without profile phone when schema does not include profiles.phone", async () => {
  const projectSelectColumnsLog: string[] = [];
  const supabase = createProjectsSupabase({
    includePhoneData: false,
    simulateMissingProfilesPhone: true,
    projectSelectColumnsLog,
  });

  const result = await listProjects(supabase as never, {
    search: "Alpha",
    page: 1,
    pageSize: 10,
    dueWindow: "all",
  });

  assert.equal(result.total, 1);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]?.id, "project-1");
  assert.equal(result.items[0]?.organizationOwnerPhone, null);
  assert.equal(result.items[0]?.ownerPhone, null);
  assert.equal(projectSelectColumnsLog.some((columns) => columns.includes("phone")), true);
  assert.equal(
    projectSelectColumnsLog.some((columns) => columns.includes("first_name, last_name, email)") && !columns.includes("phone")),
    true,
  );
});

test("CRM stable helpers return filtered, paginated, and summarized results", async () => {
  const supabase = createCrmSupabase();
  const contacts = await listCrmContacts(supabase as never, {
    page: 1,
    pageSize: 1,
    search: "ana",
    status: "lead",
    organizationId: "org-1",
    ownerProfileId: "owner-1",
  });
  assert.equal(contacts.total, 2);
  assert.equal(contacts.totalPages, 2);
  assert.equal(contacts.items.length, 1);
  assert.equal(contacts.items[0]?.id, "contact-1");
  assert.deepEqual(contacts.items[0]?.organizations, { name: "Acme Labs" });

  const organizations = await listCrmOrganizations(supabase as never, {
    page: 1,
    pageSize: 1,
    search: "Bright",
  });
  assert.equal(organizations.total, 2);
  assert.equal(organizations.totalPages, 2);
  assert.equal(organizations.items[0]?.name, "Bright Growth");

  const stats = await getCrmContactStatusStats(supabase as never);
  assert.deepEqual(stats, {
    total: 3,
    byStatus: {
      lead: 2,
      qualified: 1,
      proposal: 0,
      won: 0,
      lost: 0,
    },
  });

  const owners = await listCrmOwnerOptions(supabase as never);
  assert.deepEqual(owners, [
    { id: "owner-1", label: "Sara Costa", email: "sara@example.com", role: "staff" },
    { id: "owner-2", label: "Tom Pires", email: "tom@example.com", role: "admin" },
  ]);

  const primaryContacts = await listCrmPrimaryContacts(supabase as never, { limit: 1 });
  assert.equal(primaryContacts.length, 1);
  assert.equal(primaryContacts[0]?.id, "profile-1");
  assert.equal(primaryContacts[0]?.first_name, "Sara");
  assert.equal(primaryContacts[0]?.email, "sara@example.com");

  const timeline = await listCrmStatusTimeline(supabase as never, {
    since: "2026-03-01T00:00:00.000Z",
    limit: 2,
  });
  assert.deepEqual(timeline, [
    {
      id: "status-1",
      contact_id: "contact-1",
      previous_status: "lead",
      new_status: "qualified",
      reason: "Discovery complete",
      changed_at: "2026-03-10T12:00:00.000Z",
      changed_by_user_id: "user-owner-1",
      contact_label: "Ana Silva",
      changed_by_label: "Sara Costa",
    },
    {
      id: "status-2",
      contact_id: "contact-3",
      previous_status: null,
      new_status: "lead",
      reason: null,
      changed_at: "2026-03-09T12:00:00.000Z",
      changed_by_user_id: null,
      contact_label: "Bruno Matos",
      changed_by_label: null,
    },
  ]);
});

test("CRM status stats use head count queries so totals are not capped at 1000 rows", async () => {
  const crmContacts = Array.from({ length: 1205 }, (_, index) => ({
    id: `contact-${index + 1}`,
    status: index < 1005 ? "lead" : "qualified",
  }));
  const selectCalls: Array<{ table: string; columns: string; options?: SelectOptions }> = [];
  const supabase = new FakeSupabase(
    { crm_contacts: crmContacts },
    {
      defaultSelectLimit: 1000,
      selectSpy: (context) => {
        selectCalls.push(context);
      },
    },
  );

  const stats = await getCrmContactStatusStats(supabase as never);

  assert.deepEqual(stats, {
    total: 1205,
    byStatus: {
      lead: 1005,
      qualified: 200,
      proposal: 0,
      won: 0,
      lost: 0,
    },
  });
  assert.equal(selectCalls.some((call) => call.table === "crm_contacts" && call.columns === "status"), false);
  assert.equal(
    selectCalls.every((call) => call.table !== "crm_contacts" || call.options?.head === true),
    true,
  );
  assert.equal(
    selectCalls.every((call) => call.table !== "crm_contacts" || call.options?.count === "planned"),
    true,
  );
});

test("CRM handler helpers parse params and return JSON envelopes", async () => {
  assert.deepEqual(
    parseCrmContactsRequest("https://example.com/api/crm/contacts?page=2&pageSize=500&search= ana &status=lead&organizationId=org-1&ownerProfileId=owner-1"),
    {
      page: 2,
      pageSize: 100,
      search: "ana",
      status: "lead",
      organizationId: "org-1",
      ownerProfileId: "owner-1",
    },
  );

  assert.deepEqual(
    parseCrmOrganizationsRequest("https://example.com/api/crm/organizations?page=3&pageSize=999&search= bright "),
    { page: 3, pageSize: 100, search: "bright" },
  );

  let receivedContactsParams: Record<string, unknown> | null = null;
  const contactsHandler = createCrmContactsGetHandler({
    getAccess: async () => ({ ok: true, supabase: {} }),
    listContacts: async (_supabase, params) => {
      receivedContactsParams = params as Record<string, unknown>;
      return { items: [], page: 2, pageSize: 25, total: 0, totalPages: 1 };
    },
    listOrganizations: async () => ({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 }),
    getStats: async () => ({ total: 0, byStatus: {} }),
    listOwners: async () => [],
  });
  const contactsResponse = await contactsHandler(
    new Request("https://example.com/api/crm/contacts?page=2&pageSize=25&search=ana&status=lead"),
  );
  assert.equal(contactsResponse.status, 200);
  assert.deepEqual(receivedContactsParams, {
    page: 2,
    pageSize: 25,
    search: "ana",
    status: "lead",
    organizationId: null,
    ownerProfileId: null,
  });
  assert.deepEqual(await contactsResponse.json(), {
    items: [],
    page: 2,
    pageSize: 25,
    total: 0,
    totalPages: 1,
  });

  const organizationsHandler = createCrmOrganizationsGetHandler({
    getAccess: async () => ({ ok: true, supabase: {} }),
    listContacts: async () => ({ items: [], page: 1, pageSize: 50, total: 0, totalPages: 1 }),
    listOrganizations: async (_supabase, params) => ({
      items: [{ id: "org-1", name: params.search ?? "", industry: null, company_size: null, budget_range: null, website_url: null, address: null, taxIdentifierValue: null, primary_contact_id: null, created_at: "2026-01-01T00:00:00.000Z" }],
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
      total: 1,
      totalPages: 1,
    }),
    getStats: async () => ({ total: 0, byStatus: {} }),
    listOwners: async () => [],
  });
  const organizationsResponse = await organizationsHandler(
    new Request("https://example.com/api/crm/organizations?page=3&pageSize=40&search=Bright"),
  );
  assert.equal(organizationsResponse.status, 200);
  assert.deepEqual(await organizationsResponse.json(), {
    items: [
      {
        id: "org-1",
        name: "Bright",
        industry: null,
        company_size: null,
        budget_range: null,
        website_url: null,
        address: null,
        taxIdentifierValue: null,
        primary_contact_id: null,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    page: 3,
    pageSize: 40,
    total: 1,
    totalPages: 1,
  });

  const statsHandler = createCrmStatsGetHandler({
    getAccess: async () => ({ ok: false, status: 401, error: "Auth required" }),
    listContacts: async () => ({ items: [], page: 1, pageSize: 50, total: 0, totalPages: 1 }),
    listOrganizations: async () => ({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 }),
    getStats: async () => ({ total: 0, byStatus: {} }),
    listOwners: async () => [],
  });
  const statsResponse = await statsHandler(new Request("https://example.com/api/crm/stats"));
  assert.equal(statsResponse.status, 401);
  assert.deepEqual(await statsResponse.json(), { error: "Auth required" });

  const ownersHandler = createCrmOwnersGetHandler({
    getAccess: async () => ({ ok: true, supabase: {} }),
    listContacts: async () => ({ items: [], page: 1, pageSize: 50, total: 0, totalPages: 1 }),
    listOrganizations: async () => ({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 }),
    getStats: async () => ({ total: 0, byStatus: {} }),
    listOwners: async () => {
      throw new Error("Broken owners");
    },
  });
  const ownersResponse = await ownersHandler(new Request("https://example.com/api/crm/owners"));
  assert.equal(ownersResponse.status, 500);
  assert.deepEqual(await ownersResponse.json(), { error: "Broken owners" });
});
