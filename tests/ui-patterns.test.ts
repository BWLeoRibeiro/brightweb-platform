import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { getInitials, getPaginationWindow, getRoleLabel, resolveRoleToken } from "../packages/ui/src/lib/patterns.ts";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);

const patternExports = {
  action: ["ActionButton", "actionClassName"],
  "empty-state": ["EmptyState"],
  "initials-avatar": ["InitialsAvatar"],
  "kpi-breakdown-bar": ["KpiBreakdownBar"],
  "role-badge": ["RoleBadge", "DEFAULT_ROLE_TOKEN_MAP"],
  "section-heading": ["SectionHeading"],
  "stat-tile": ["StatTile", "StatValue"],
  "status-pill": ["StatusPill", "STATUS_PILL_BASE_CLASS", "STATUS_PILL_SIZE_CLASSES"],
  "surface-card": ["SurfaceCard"],
  "table-pagination": ["TablePagination"],
} as const;

test("every Tier-2 pattern has a package subpath and root export", async () => {
  const packageJson = JSON.parse(await readFile(path.join(repoRoot, "packages/ui/package.json"), "utf8"));
  const rootSource = await readFile(path.join(repoRoot, "packages/ui/src/index.ts"), "utf8");

  for (const subpath of Object.keys(patternExports)) {
    assert.equal(packageJson.exports[`./${subpath}`], `./src/components/${subpath}.tsx`);
    assert.match(rootSource, new RegExp(`components/${subpath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  }
});

test("Checkbox exposes the native selection-control contract", async () => {
  const packageJson = JSON.parse(await readFile(path.join(repoRoot, "packages/ui/package.json"), "utf8"));
  const rootSource = await readFile(path.join(repoRoot, "packages/ui/src/index.ts"), "utf8");
  const checkboxSource = await readFile(path.join(repoRoot, "packages/ui/src/components/checkbox.tsx"), "utf8");

  assert.equal(packageJson.exports["./checkbox"], "./src/components/checkbox.tsx");
  assert.match(rootSource, /components\/checkbox/);
  assert.match(checkboxSource, /<input type="checkbox" \{\.\.\.props\} \/>/);
});

for (const [subpath, symbols] of Object.entries(patternExports)) {
  test(`${subpath} exposes its documented Tier-2 API`, async () => {
    const source = await readFile(path.join(repoRoot, `packages/ui/src/components/${subpath}.tsx`), "utf8");
    for (const symbol of symbols) {
      assert.match(source, new RegExp(`export (?:const|function) ${symbol}\\b`));
    }
  });
}

test("Tier-2 pure helpers clamp pagination and derive neutral labels", () => {
  assert.deepEqual(getPaginationWindow(1, 8), [1, 2, "end-ellipsis", 8]);
  assert.deepEqual(getPaginationWindow(5, 8), [1, "start-ellipsis", 4, 5, 6, "end-ellipsis", 8]);
  assert.equal(getInitials("Ada Lovelace"), "AL");
  assert.equal(getInitials(null, "person@example.test"), "P");
  assert.equal(getRoleLabel("project_owner"), "Project Owner");
  assert.equal(resolveRoleToken("admin", { admin: "--role-admin" }), "--role-admin");
  assert.equal(resolveRoleToken("custom", {}), "--semantic-neutral");
});
