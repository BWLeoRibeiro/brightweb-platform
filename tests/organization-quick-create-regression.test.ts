import assert from "node:assert/strict";
import test from "node:test";

import { createProjectsUiClient } from "../packages/module-projects/src/ui/client.ts";

test("Projects raw requests preserve canonical cross-module API paths", async () => {
  const urls: string[] = [];
  const fetcher = async (input: URL | RequestInfo) => {
    urls.push(String(input));
    return new Response(null, { status: 204 });
  };
  const client = createProjectsUiClient("/api/projects", fetcher as typeof fetch);

  await client.requestRaw("/api/organizations", { method: "POST" });
  await client.requestRaw("/api/projects/project-1", { method: "PATCH" });
  await client.requestRaw("/project-2", { method: "PATCH" });

  assert.deepEqual(urls, [
    "/api/organizations",
    "/api/projects/project-1",
    "/api/projects/project-2",
  ]);
});
