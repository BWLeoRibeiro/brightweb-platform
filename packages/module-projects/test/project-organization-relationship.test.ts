import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listProjects as listDataProjects } from "../src/data.ts";
import { listProjects as listServerProjects } from "../src/server.ts";

type QueryError = { code?: string; message: string };
type QueryResponse = { data: unknown[]; error: QueryError | null; count: number };
type ListProjects = typeof listServerProjects;

function createProjectsClient(
  respond: (columns: string, attempt: number) => QueryResponse,
): { supabase: SupabaseClient; selects: string[] } {
  const selects: string[] = [];

  const supabase = {
    from(table: string) {
      assert.equal(table, "projects");
      return {
        select(columns: string) {
          const attempt = selects.length;
          selects.push(columns);
          const response = respond(columns, attempt);
          const query = {
            order: () => query,
            range: () => query,
            not: () => query,
            or: () => query,
            eq: () => query,
            lt: () => query,
            gte: () => query,
            lte: () => query,
            in: () => query,
            then: <TResult1 = QueryResponse, TResult2 = never>(
              onFulfilled?: ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
              onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
            ) => Promise.resolve(response).then(onFulfilled, onRejected),
          };
          return query;
        },
      };
    },
  } as unknown as SupabaseClient;

  return { supabase, selects };
}

const listImplementations: Array<[string, ListProjects]> = [
  ["server", listServerProjects],
  ["data", listDataProjects as ListProjects],
];

for (const [implementation, listProjects] of listImplementations) {
  test(`${implementation} listProjects selects the primary organization relationship`, async () => {
    const { supabase, selects } = createProjectsClient((columns) => ({
      data: [],
      error: /(^|,\s*)organizations\(/.test(columns)
        ? { code: "PGRST201", message: "Could not embed because more than one relationship was found" }
        : null,
      count: 0,
    }));

    await listProjects(supabase, { page: 1, pageSize: 9, status: "all" });

    assert.equal(selects.length, 1);
    assert.match(selects[0] ?? "", /organizations!projects_organization_id_fkey\(/);
  });

  test(`${implementation} legacy retry preserves the explicit organization relationship`, async () => {
    const { supabase, selects } = createProjectsClient((_columns, attempt) => ({
      data: [],
      error: attempt === 0 ? { message: "column projects.cancellation_reason does not exist" } : null,
      count: 0,
    }));

    await listProjects(supabase, { page: 1, pageSize: 9, status: "all" });

    assert.equal(selects.length, 2);
    assert.match(selects[0] ?? "", /cancellation_reason/);
    assert.doesNotMatch(selects[1] ?? "", /cancellation_reason/);
    assert.match(selects[1] ?? "", /organizations!projects_organization_id_fkey\(/);
  });

  test(`${implementation} listProjects does not hide unrelated relationship errors`, async () => {
    const { supabase, selects } = createProjectsClient(() => ({
      data: [],
      error: { code: "PGRST201", message: "Another embedded relationship is ambiguous" },
      count: 0,
    }));

    await assert.rejects(
      listProjects(supabase, { page: 1, pageSize: 9, status: "all" }),
      /Another embedded relationship is ambiguous/,
    );
    assert.equal(selects.length, 1);
  });
}
