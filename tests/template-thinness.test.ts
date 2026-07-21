import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { findTemplateThinnessViolations } from "../scripts/template-thinness.mjs";

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

test("scaffold routes are direct package mounts with no app-owned logic", async () => {
  const violations = await findTemplateThinnessViolations(
    path.join(REPO_ROOT, "packages", "create-bw-app", "template"),
  );

  assert.deepEqual(violations, []);
});
