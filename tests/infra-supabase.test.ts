import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createServerSupabase,
  createServiceRoleClient,
} from "../packages/infra/src/server.ts";

test("resolveSupabasePublicEnv preserves statically captured NEXT_PUBLIC values", async (t) => {
  const keys = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ] as const;
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  t.after(() => {
    for (const key of keys) {
      const value = original[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://build-time.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY = "sb_publishable_build_time";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_fallback";

  const envModule = await import("../packages/infra/src/supabase-env.ts?static-public-env-test");
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://runtime.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY = "sb_publishable_runtime";

  assert.deepEqual(envModule.resolveSupabasePublicEnv(), {
    supabaseUrl: "https://build-time.supabase.co",
    supabasePublishableKey: "sb_publishable_build_time",
  });

  const source = await readFile("packages/infra/src/supabase-env.ts", "utf8");
  for (const key of keys) {
    assert.match(source, new RegExp(`${key}: process\\.env\\.${key}`));
  }
});

test("createServerSupabase passes public env and cookie adapters to the SSR client", async () => {
  const setCalls: unknown[][] = [];
  const cookieStore = {
    getAll: () => [{ name: "session", value: "cookie-value" }],
    set: (...args: unknown[]) => {
      setCalls.push(args);
    },
  };
  let constructorCall: {
    url: string;
    key: string;
    options: {
      cookies: {
        getAll(): unknown;
        setAll(values: Array<{ name: string; value: string; options: Record<string, unknown> }>): void;
      };
    };
  } | null = null;
  const marker = { kind: "server-client" };

  const result = await createServerSupabase({
    resolvePublicEnv: () => ({
      supabaseUrl: "https://public.supabase.co",
      supabasePublishableKey: "sb_publishable_public",
    }),
    getCookies: async () => cookieStore as never,
    createServerClient: ((url: string, key: string, options: never) => {
      constructorCall = { url, key, options };
      return marker;
    }) as never,
  });

  assert.equal(result, marker);
  assert.equal(constructorCall?.url, "https://public.supabase.co");
  assert.equal(constructorCall?.key, "sb_publishable_public");
  assert.deepEqual(constructorCall?.options.cookies.getAll(), [
    { name: "session", value: "cookie-value" },
  ]);
  constructorCall?.options.cookies.setAll([
    { name: "session", value: "updated", options: { httpOnly: true } },
  ]);
  assert.deepEqual(setCalls, [
    ["session", "updated", { httpOnly: true }],
  ]);
});

test("createServerSupabase tolerates cookie writes in read-only server contexts", async () => {
  let cookieOptions: {
    cookies: {
      setAll(values: Array<{ name: string; value: string; options: Record<string, unknown> }>): void;
    };
  } | null = null;
  await createServerSupabase({
    resolvePublicEnv: () => ({
      supabaseUrl: "https://public.supabase.co",
      supabasePublishableKey: "sb_publishable_public",
    }),
    getCookies: async () => ({
      getAll: () => [],
      set: () => {
        throw new Error("read-only");
      },
    }) as never,
    createServerClient: ((_url: string, _key: string, options: never) => {
      cookieOptions = options;
      return {};
    }) as never,
  });

  assert.doesNotThrow(() => cookieOptions?.cookies.setAll([
    { name: "session", value: "updated", options: {} },
  ]));
});

test("createServiceRoleClient uses secret env and disables session persistence", () => {
  let constructorCall: {
    url: string;
    key: string;
    options: unknown;
  } | null = null;
  const marker = { kind: "service-role-client" };
  const result = createServiceRoleClient({
    resolveUrl: () => "https://service.supabase.co",
    resolveServiceRoleKey: () => "sb_secret_service",
    createClient: ((url: string, key: string, options: unknown) => {
      constructorCall = { url, key, options };
      return marker;
    }) as never,
  });

  assert.equal(result, marker);
  assert.deepEqual(constructorCall, {
    url: "https://service.supabase.co",
    key: "sb_secret_service",
    options: {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  });
});

test("createServiceRoleClient does not construct a client with incomplete env", () => {
  let constructorCalls = 0;
  const result = createServiceRoleClient({
    resolveUrl: () => null,
    resolveServiceRoleKey: () => "sb_secret_service",
    createClient: (() => {
      constructorCalls += 1;
      return {};
    }) as never,
  });

  assert.equal(result, null);
  assert.equal(constructorCalls, 0);
});

test("local preview injects the new-format Supabase secret key", async () => {
  const source = await readFile("scripts/with-local-preview-supabase.mjs", "utf8");

  assert.match(source, /const localSecretKey = local\.SECRET_KEY/);
  assert.match(source, /SUPABASE_SECRET_DEFAULT_KEY: localSecretKey/);
  assert.doesNotMatch(source, /SUPABASE_SECRET_DEFAULT_KEY: local\.SERVICE_ROLE_KEY/);
});
