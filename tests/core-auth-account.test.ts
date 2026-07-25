import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { createAccountGetHandler, createAccountUpdateHandler } from "../packages/core-auth/src/account/http.ts";
import { getCurrentAccountProfile } from "../packages/core-auth/src/account/profile.ts";
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

test("preview account mounts are thin and the projects insertion point remains explicit", async () => {
  const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
  const page = await readFile(path.join(repoRoot, "apps/platform-preview/app/(shell)/account/page.tsx"), "utf8");
  const route = await readFile(path.join(repoRoot, "apps/platform-preview/app/api/account/route.ts"), "utf8");
  const surface = await readFile(path.join(repoRoot, "packages/core-auth/src/account-page.tsx"), "utf8");
  assert.match(page, /AccountPage as default/);
  assert.match(route, /handleAccountGetRequest/);
  assert.match(route, /handleAccountUpdateRequest/);
  assert.match(surface, /TODO\(projects-live\)/);
});
