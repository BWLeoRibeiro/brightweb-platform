import assert from "node:assert/strict";
import test from "node:test";
import { updateCurrentAccountProfile } from "./profile.ts";

test("updateCurrentAccountProfile persists profiles, preferences, and auth metadata", async () => {
  const writes: Array<{ table: string; value: unknown; options: unknown }> = [];
  const metadata: unknown[] = [];
  let profilesCall = 0;

  const supabase = {
    from(table: string) {
      if (table === "profiles") {
        profilesCall += 1;
        if (profilesCall === 2) {
          const writeQuery = {
            upsert(value: unknown, options: unknown) {
              writes.push({ table, value, options });
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
        async upsert(value: unknown, options: unknown) {
          writes.push({ table, value, options });
          return { error: null };
        },
      };
    },
    auth: {
      async updateUser(value: unknown) {
        metadata.push(value);
        return { error: null };
      },
    },
  } as unknown as Parameters<typeof updateCurrentAccountProfile>[0];

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
