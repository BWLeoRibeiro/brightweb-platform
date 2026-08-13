import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { createAccountGetHandler, createAccountUpdateHandler } from "../packages/core-auth/src/account/http.ts";
import { getCurrentAccountProfile } from "../packages/core-auth/src/account/profile.ts";
import { createProjectReadAccessGuard } from "../packages/core-auth/src/server.ts";
import { createAccountUiClient } from "../packages/core-auth/src/ui/account/client.ts";

type QueryResult = {
  data: unknown;
  error: null | { code?: string; message: string; details?: string; hint?: string };
};

type QueryCall = {
  table: string;
  selected: string[];
  equals: Array<[string, unknown]>;
};

function profileRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "profile-1",
    email: "ana@example.com",
    first_name: "Ana",
    last_name: "Silva",
    updated_at: "2026-06-24T10:00:00.000Z",
    ...overrides,
  };
}

function createReadSupabase(results: QueryResult[]) {
  const calls: QueryCall[] = [];
  const queue = [...results];
  const from = (table: string) => {
    const call: QueryCall = { table, selected: [], equals: [] };
    calls.push(call);
    const query = {
      select(columns: string) {
        call.selected.push(columns);
        return query;
      },
      eq(column: string, value: unknown) {
        call.equals.push([column, value]);
        return query;
      },
      async maybeSingle() {
        return queue.shift() ?? { data: null, error: null };
      },
    };
    return query;
  };
  return {
    calls,
    supabase: { from } as unknown as Parameters<typeof getCurrentAccountProfile>[0],
  };
}

test("account profile reads embedded preferences and defaults missing profiles", async () => {
  const embedded = createReadSupabase([
    { data: profileRow({ preferences: { preferred_language: "en" } }), error: null },
  ]);
  const embeddedResult = await getCurrentAccountProfile(embedded.supabase, "user-1", null);
  assert.equal(embeddedResult.ok && embeddedResult.data.preferredLanguage, "en");

  const missing = createReadSupabase([{ data: null, error: null }]);
  assert.deepEqual(await getCurrentAccountProfile(missing.supabase, "user-1", "fallback@example.com"), {
    ok: true,
    data: {
      profileId: null,
      email: "fallback@example.com",
      firstName: "",
      lastName: "",
      preferredLanguage: "pt-PT",
      updatedAt: null,
    },
  });
});

for (const code of ["PGRST200", "PGRST201"]) {
  test(`account profile uses the hand-rolled preference fallback for ${code}`, async () => {
    const { calls, supabase } = createReadSupabase([
      {
        data: null,
        error: {
          code,
          message: "Could not find a relationship between profiles and user_preferences in the schema cache",
        },
      },
      { data: profileRow(), error: null },
      { data: { preferred_language: "en" }, error: null },
    ]);

    const result = await getCurrentAccountProfile(supabase, "user-1", null);
    assert.equal(result.ok && result.data.preferredLanguage, "en");
    assert.deepEqual(calls.map((call) => call.table), ["profiles", "profiles", "user_preferences"]);
    assert.equal(calls[1].selected[0], "id, email, first_name, last_name, updated_at");
    assert.deepEqual(calls[2].equals, [["profile_id", "profile-1"]]);
  });
}

test("account handlers validate updates and preserve the injectable client boundary", async () => {
  const access = {
    ok: true as const,
    supabase: {},
    user: { id: "user-1", email: "ana@example.com" } as never,
    profileId: "profile-1",
    role: "client",
  };
  const profile = {
    profileId: "profile-1",
    email: "ana@example.com",
    firstName: "Ana",
    lastName: "Silva",
    preferredLanguage: "pt-PT" as const,
    updatedAt: null,
  };
  const getHandler = createAccountGetHandler({
    getAccess: async () => access,
    getProfile: async () => ({ ok: true, data: profile }),
    updateProfile: async () => ({ ok: true, data: profile }),
  });
  assert.deepEqual(await (await getHandler(new Request("https://portal.test/api/account"))).json(), { data: profile });

  const updateHandler = createAccountUpdateHandler({
    getAccess: async () => access,
    getProfile: async () => ({ ok: true, data: profile }),
    updateProfile: async (_supabase, _user, input) => ({ ok: true, data: { ...profile, ...input } }),
  });
  const invalid = await updateHandler(new Request("https://portal.test/api/account", {
    method: "PATCH",
    body: JSON.stringify({ firstName: "A".repeat(81), lastName: "", preferredLanguage: "pt-PT" }),
  }));
  assert.equal(invalid.status, 400);
  assert.deepEqual(await invalid.json(), {
    error: {
      code: "INVALID_NAME",
      message: "Nome inválido. Limite máximo de 80 caracteres por campo.",
    },
  });

  const invalidLanguage = await updateHandler(new Request("https://portal.test/api/account", {
    method: "PATCH",
    body: JSON.stringify({ firstName: "Ana", lastName: "Silva", preferredLanguage: "es" }),
  }));
  assert.equal(invalidLanguage.status, 400);
  assert.deepEqual(await invalidLanguage.json(), {
    error: { code: "INVALID_LANGUAGE", message: "Idioma inválido." },
  });

  const client = createAccountUiClient("/api/account/", async (input, init) => {
    assert.equal(input, "/api/account");
    assert.equal(init?.method, "PATCH");
    return Response.json({ data: profile });
  });
  assert.deepEqual(await client.updateProfile({
    firstName: "Ana",
    lastName: "Silva",
    preferredLanguage: "pt-PT",
  }), profile);
});

test("account GET handler sanitizes profile read failures", async () => {
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const handler = createAccountGetHandler({
      getAccess: async () => ({
        ok: true,
        supabase: {},
        user: { id: "user-1", email: "ana@example.com" } as never,
      }),
      getProfile: async () => ({ ok: false, error: "raw database detail" }),
      updateProfile: async () => {
        throw new Error("must not run");
      },
    });

    const response = await handler(new Request("https://portal.test/api/account"));
    assert.equal(response.status, 500);
    const payload = await response.json();
    assert.deepEqual(payload, {
      error: {
        code: "INTERNAL_ERROR",
        message: "Não foi possível concluir o pedido da conta.",
      },
    });
    assert.doesNotMatch(JSON.stringify(payload), /raw database detail/);
  } finally {
    console.error = originalConsoleError;
  }
});

test("profile-only account mode keeps self-editing and removes work access", async () => {
  const source = await readFile(path.join(process.cwd(), "packages/core-auth/src/account-page.tsx"), "utf8");
  const profileEditorIndex = source.indexOf("<AccountClient profile={profileData} />");
  const workAccessConditionalIndex = source.indexOf("{showWorkAccess ? (", profileEditorIndex);

  assert.ok(profileEditorIndex >= 0, "the personal profile editor must always render");
  assert.ok(
    workAccessConditionalIndex > profileEditorIndex,
    "showWorkAccess must guard the work-access panel, not the personal profile editor",
  );
});

type ProjectQueryResult = {
  data: unknown;
  error: null | { code?: string; message: string };
};

function createProjectServiceClient(results: Record<string, ProjectQueryResult[]>) {
  const calls: Array<{ table: string; equals: Array<[string, unknown]> }> = [];
  return {
    calls,
    client: {
      from(table: string) {
        const call = { table, equals: [] as Array<[string, unknown]> };
        calls.push(call);
        const query = {
          select() {
            return query;
          },
          eq(column: string, value: unknown) {
            call.equals.push([column, value]);
            return query;
          },
          async maybeSingle() {
            return results[table]?.shift() ?? { data: null, error: null };
          },
        };
        return query;
      },
    },
  };
}

function projectAccess(
  role: "client" | "staff" = "client",
  clientResult: { data: boolean; error: { message: string } | null } = { data: false, error: null },
) {
  return {
    ok: true as const,
    supabase: {
      rpc: async (name: string, args: unknown) => {
        assert.equal(name, "can_current_client_view_project");
        assert.deepEqual(args, { target_project_id: "project-1" });
        return clientResult;
      },
    } as never,
    user: { id: "user-1", email: "ana@example.com" } as never,
    profileId: "profile-1",
    role,
  };
}

test("project read access passes admins without querying projects", async () => {
  let serviceClientCalls = 0;
  const guard = createProjectReadAccessGuard({
    getAccess: async () => ({ ...projectAccess(), role: "admin" }),
    getServiceClient: () => {
      serviceClientCalls += 1;
      throw new Error("must not run");
    },
  });

  assert.equal((await guard("project-1")).ok, true);
  assert.equal(serviceClientCalls, 0);
});

test("client project read access uses the canonical database predicate", async () => {
  let serviceClientCalls = 0;
  const allowed = createProjectReadAccessGuard({
    getAccess: async () => projectAccess("client", { data: true, error: null }),
    getServiceClient: () => {
      serviceClientCalls += 1;
      throw new Error("must not run");
    },
  });
  const denied = createProjectReadAccessGuard({
    getAccess: async () => projectAccess(),
    getServiceClient: () => {
      serviceClientCalls += 1;
      throw new Error("must not run");
    },
  });

  assert.equal((await allowed("project-1")).ok, true);
  assert.deepEqual(await denied("project-1"), {
    ok: false,
    status: 404,
    error: "Projeto não encontrado.",
  });
  assert.equal(serviceClientCalls, 0);
});

test("staff project read access accepts project members, direct owners, and organization admins", async () => {
  const cases = [
    {
      label: "project member",
      project: { id: "project-1", organization_id: null, owner_profile_id: "other" },
      membership: { role: "observer" },
      organizationMembership: undefined,
    },
    {
      label: "direct owner",
      project: { id: "project-1", organization_id: null, owner_profile_id: "profile-1" },
      membership: null,
      organizationMembership: undefined,
    },
    {
      label: "organization admin",
      project: { id: "project-1", organization_id: "org-1", owner_profile_id: "other" },
      membership: null,
      organizationMembership: { role: "admin" },
    },
  ];

  for (const item of cases) {
    const service = createProjectServiceClient({
      projects: [{ data: item.project, error: null }],
      project_members: [{ data: item.membership, error: null }],
      organization_members: item.organizationMembership
        ? [{ data: item.organizationMembership, error: null }]
        : [],
    });
    const guard = createProjectReadAccessGuard({
      getAccess: async () => projectAccess("staff"),
      getServiceClient: () => service.client as never,
    });
    assert.equal((await guard("project-1")).ok, true, item.label);
  }
});

test("project read access returns the same 404 for missing and forbidden projects", async () => {
  const run = async (project: unknown) => {
    const service = createProjectServiceClient({
      projects: [{ data: project, error: null }],
      project_members: project ? [{ data: null, error: null }] : [],
    });
    return createProjectReadAccessGuard({
      getAccess: async () => projectAccess("staff"),
      getServiceClient: () => service.client as never,
    })("project-1");
  };

  const missing = await run(null);
  const forbidden = await run({
    id: "project-1",
    organization_id: null,
    owner_profile_id: "other",
  });
  assert.deepEqual(missing, forbidden);
  assert.deepEqual(forbidden, {
    ok: false,
    status: 404,
    error: "Projeto não encontrado.",
  });
});

test("project read access reports project, membership, and organization query failures as 503", async () => {
  const failures = [
    {
      projects: [{ data: null, error: { code: "XX000", message: "projects unavailable" } }],
    },
    {
      projects: [{
        data: { id: "project-1", organization_id: null, owner_profile_id: "other" },
        error: null,
      }],
      project_members: [{ data: null, error: { message: "members unavailable" } }],
    },
    {
      projects: [{
        data: { id: "project-1", organization_id: "org-1", owner_profile_id: "other" },
        error: null,
      }],
      project_members: [{ data: null, error: null }],
      organization_members: [{ data: null, error: { message: "organizations unavailable" } }],
    },
  ];
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    for (const failure of failures) {
      const service = createProjectServiceClient(failure);
      const result = await createProjectReadAccessGuard({
        getAccess: async () => projectAccess("staff"),
        getServiceClient: () => service.client as never,
      })("project-1");
      assert.deepEqual(result, {
        ok: false,
        status: 503,
        error: "Não foi possível validar o acesso ao projeto.",
      });
    }
  } finally {
    console.error = originalConsoleError;
  }
});

test("account keeps personal settings separate from the dedicated projects area", async () => {
  const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
  const page = await readFile(path.join(repoRoot, "apps/platform-preview/app/(shell)/account/page.tsx"), "utf8");
  const route = await readFile(path.join(repoRoot, "apps/platform-preview/app/api/account/route.ts"), "utf8");
  const surface = await readFile(path.join(repoRoot, "packages/core-auth/src/account-page.tsx"), "utf8");
  assert.match(page, /<ClientAccountPage internalProjectsHref="\/projects" \/>/);
  assert.match(route, /handleAccountGetRequest/);
  assert.match(route, /handleAccountUpdateRequest/);
  assert.doesNotMatch(surface, /projectsSlot/);
  assert.match(surface, /href=\{isClient \? "\/account\/projetos" : internalProjectsHref\}/);
  assert.doesNotMatch(surface, /module-projects/);
  assert.match(surface, /console\.error\("\[core-auth\.AccountPage\.profile\]"/);
  assert.doesNotMatch(surface, /loadError\}: \{accountProfile\.error\}/);
  assert.match(surface, /<InitialsAvatar/);
  assert.match(surface, /var\(--account-client-cover\)/);
  assert.match(surface, /<StatusPill token="--role-client"/);
});
