import assert from "node:assert/strict";
import test from "node:test";

import {
  createTopic,
  updateTopic,
} from "../packages/module-marketing/src/server.ts";

const storedTopic = {
  id: "00000000-0000-4000-8000-000000000072",
  slug: "novidades",
  label: "Novidades",
  description: "Artigos e atualizações.",
  is_active: true,
  position: 10,
  created_at: "2026-07-31T10:00:00.000Z",
  updated_at: "2026-07-31T10:00:00.000Z",
};

test("topic writes normalize inputs and preserve the public topic shape", async () => {
  const writes: Array<{ operation: string; payload: unknown; id?: string }> = [];
  const supabase = {
    from(table: string) {
      assert.equal(table, "marketing_topics");
      return {
        insert(payload: unknown) {
          writes.push({ operation: "insert", payload });
          return {
            select() { return this; },
            single: async () => ({ data: storedTopic, error: null }),
          };
        },
        update(payload: unknown) {
          const write = { operation: "update", payload, id: "" };
          writes.push(write);
          return {
            eq(field: string, id: string) {
              assert.equal(field, "id");
              write.id = id;
              return this;
            },
            select() { return this; },
            maybeSingle: async () => ({
              data: { ...storedTopic, label: "Notícias", is_active: false, position: 20 },
              error: null,
            }),
          };
        },
      };
    },
  };

  const created = await createTopic(supabase, {
    slug: " novidades ",
    label: " Novidades ",
    description: " Artigos e atualizações. ",
    position: 10,
  });
  const updated = await updateTopic(supabase, storedTopic.id, {
    label: " Notícias ",
    description: null,
    isActive: false,
    position: 20,
  });

  assert.deepEqual(writes, [
    {
      operation: "insert",
      payload: {
        slug: "novidades",
        label: "Novidades",
        description: "Artigos e atualizações.",
        position: 10,
      },
    },
    {
      operation: "update",
      id: storedTopic.id,
      payload: {
        label: "Notícias",
        description: null,
        position: 20,
        is_active: false,
      },
    },
  ]);
  assert.equal(created.isActive, true);
  assert.equal(created.position, 10);
  assert.equal(updated.label, "Notícias");
  assert.equal(updated.isActive, false);
});

test("topic writes reject invalid labels, slugs, and positions before database IO", async () => {
  const supabase = { from: () => { throw new Error("database should not be called"); } };
  await assert.rejects(
    () => createTopic(supabase, { slug: "Invalid Slug", label: "News" }),
    /lowercase letters, numbers, and hyphens/,
  );
  await assert.rejects(
    () => createTopic(supabase, { slug: "news", label: " " }),
    /label is required/,
  );
  await assert.rejects(
    () => updateTopic(supabase, storedTopic.id, { position: -1 }),
    /non-negative integer/,
  );
});
