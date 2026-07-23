import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);

async function read(relativePath: string) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

test("admin UI exposes an injectable client and keeps fetch out of components", async () => {
  const component = await read("packages/module-admin/src/ui/admin-users.tsx");
  const client = await read("packages/module-admin/src/ui/client.ts");
  const types = await read("packages/module-admin/src/ui/types.ts");

  assert.doesNotMatch(component, /\bfetch\s*\(/);
  assert.match(component, /client\.listUsers\(/);
  assert.match(component, /client\.listInvitations\(/);
  assert.match(component, /client\.inviteUser\(/);
  assert.match(component, /client\.revokeInvitation\(/);
  assert.match(component, /client\.changeRoles\(/);
  assert.match(client, /createAdminUiClient/);
  assert.match(types, /export type AdminUiClient/);
});

test("admin package exposes users, invitations, toolbar, loading, and tokens", async () => {
  const packageJson = JSON.parse(await read("packages/module-admin/package.json"));
  const uiIndex = await read("packages/module-admin/src/ui/index.ts");
  const registration = await read("packages/module-admin/src/registration.ts");

  assert.equal(packageJson.exports["./ui"], "./src/ui/index.ts");
  assert.equal(packageJson.exports["./tokens.css"], "./tokens.css");
  assert.match(uiIndex, /admin-users/);
  assert.match(uiIndex, /toolbar-controls/);
  assert.match(uiIndex, /loading/);
  assert.match(registration, /"admin-users"/);
  assert.match(registration, /admin-search/);
  assert.match(registration, /admin-filters/);
});

test("preview mounts the live packaged admin page and routes", async () => {
  const overview = await read("apps/platform-preview/app/(shell)/admin/page.tsx");
  const users = await read("apps/platform-preview/app/(shell)/admin/users/page.tsx");
  const layout = await read("apps/platform-preview/app/(shell)/shell-layout-client.tsx");
  const usersRoute = await read("apps/platform-preview/app/api/admin/users/route.ts");

  assert.match(overview, /redirect\("\/admin\/users"\)/);
  assert.match(users, /AdminUsersPage as default/);
  assert.match(usersRoute, /handleAdminUsersGetRequest/);
  assert.match(layout, /AppShellFrame/);
  assert.match(layout, /AdminToolbarControls/);
});
