import assert from "node:assert/strict";
import test from "node:test";
import { updateCurrentAccountProfile } from "./profile.ts";

function createUpdateSupabase(options: {
  preferencesError?: { message: string } | null;
  authError?: { message: string } | null;
} = {}) {
  const writes: Array<{ table: string; value: unknown; options: unknown }> = [];
  const metadata: unknown[] = [];
  let profilesCall = 0;

  const supabase = {
    from(table: string) {
      if (table === "profiles") {
        profilesCall += 1;
        if (profilesCall === 2) {
          const writeQuery = {
            upsert(value: unknown, upsertOptions: unknown) {
              writes.push({ table, value, options: upsertOptions });
              return writeQuery;
            },
            select() {
              return writeQuery;
            },
            async single() {
              return { data: { id: "profile-1" }, error: null };
            },
          };
          return writeQuery;
        }

        const data = {
          id: "profile-1",
          email: "ana@example.com",
          first_name: profilesCall === 1 ? "Ana" : "Maria",
          last_name: profilesCall === 1 ? "Silva" : "Costa",
          updated_at: "2026-06-24T10:00:00.000Z",
          preferences: { preferred_language: "en" },
        };
        const readQuery = {
          select() {
            return readQuery;
          },
          eq() {
            return readQuery;
          },
          async maybeSingle() {
            return { data, error: null };
          },
        };
        return readQuery;
      }

      return {
        async upsert(value: unknown, upsertOptions: unknown) {
          writes.push({ table, value, options: upsertOptions });
          return { error: options.preferencesError ?? null };
        },
      };
    },
    auth: {
      async updateUser(value: unknown) {
        metadata.push(value);
        return { error: options.authError ?? null };
      },
    },
  } as unknown as Parameters<typeof updateCurrentAccountProfile>[0];

  return { supabase, writes, metadata };
}

test("updateCurrentAccountProfile persists profiles, preferences, and auth metadata", async () => {
  const { supabase, writes, metadata } = createUpdateSupabase();

  const result = await updateCurrentAccountProfile(
    supabase,
    { id: "user-1", email: "ana@example.com" } as never,
    { firstName: "  Maria  ", lastName: "Costa", preferredLanguage: "en" },
  );

  assert.equal(result.ok && result.data.firstName, "Maria");
  assert.deepEqual(writes, [
    {
      table: "profiles",
      value: {
        user_id: "user-1",
        email: "ana@example.com",
        first_name: "Maria",
        last_name: "Costa",
      },
      options: { onConflict: "user_id" },
    },
    {
      table: "user_preferences",
      value: { profile_id: "profile-1", preferred_language: "en" },
      options: { onConflict: "profile_id" },
    },
  ]);
  assert.deepEqual(metadata, [{ data: { first_name: "Maria", last_name: "Costa" } }]);
});

test("updateCurrentAccountProfile reports preference write failures and skips auth metadata", async () => {
  const { supabase, metadata } = createUpdateSupabase({
    preferencesError: { message: "preferences unavailable" },
  });

  const result = await updateCurrentAccountProfile(
    supabase,
    { id: "user-1", email: "ana@example.com" } as never,
    { firstName: "Maria", lastName: "Costa", preferredLanguage: "en" },
  );

  assert.deepEqual(result, { ok: false, error: "preferences unavailable" });
  assert.deepEqual(metadata, []);
});

test("updateCurrentAccountProfile logs auth metadata failures after persisting DB fields", async () => {
  const { supabase } = createUpdateSupabase({
    authError: { message: "auth provider unavailable" },
  });
  const originalConsoleError = console.error;
  const errors: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    errors.push(args);
  };

  try {
    const result = await updateCurrentAccountProfile(
      supabase,
      { id: "user-1", email: "ana@example.com" } as never,
      { firstName: "Maria", lastName: "Costa", preferredLanguage: "en" },
    );

    assert.equal(result.ok, true);
    assert.deepEqual(errors, [[
      "[core-auth.updateCurrentAccountProfile.authMetadata]",
      { userId: "user-1", message: "auth provider unavailable" },
    ]]);
  } finally {
    console.error = originalConsoleError;
  }
});

test("updateCurrentAccountProfile enforces domain name and language validation before IO", async () => {
  const noIoSupabase = {} as Parameters<typeof updateCurrentAccountProfile>[0];
  const user = { id: "user-1", email: "ana@example.com" } as never;

  assert.deepEqual(
    await updateCurrentAccountProfile(noIoSupabase, user, {
      firstName: "A".repeat(81),
      lastName: "",
      preferredLanguage: "pt-PT",
    }),
    {
      ok: false,
      error: "Nome inválido. Limite máximo de 80 caracteres por campo.",
    },
  );
  assert.deepEqual(
    await updateCurrentAccountProfile(noIoSupabase, user, {
      firstName: "Ana",
      lastName: "Silva",
      preferredLanguage: "es" as never,
    }),
    { ok: false, error: "Idioma inválido." },
  );
});
