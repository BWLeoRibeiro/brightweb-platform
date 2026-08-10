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
  assert.match(component, /usersRequestAbortRef\.current\?\.abort\(\)/);
  assert.match(component, /setLoading\(true\)[\s\S]*window\.setTimeout\(\(\) => \{[\s\S]*setDebouncedSearch/);
  assert.match(client, /signal: requestOptions\.signal/);
  assert.match(component, /toast\.warning\(dictionary\.roleChange\.unchanged/);
  assert.match(component, /toast\.warning\(dictionary\.roleChange\.skipped/);
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

test("admin keeps the view switch separate from the right-rail invitation form", async () => {
  const component = await read("packages/module-admin/src/ui/admin-users.tsx");
  const dictionary = await read("packages/module-admin/src/ui/dictionary.ts");

  assert.match(component, /activeView === "invites"/);
  assert.match(component, /setInvitePanelOpen\(true\)/);
  assert.match(component, /useShellAction\(ADMIN_EVENTS\.openInvite/);
  assert.match(component, /<Sheet open=\{invitePanelOpen\}/);
  assert.match(component, /inviteRole === "client"/);
  assert.match(component, /inviteOrganizationId/);
  assert.match(dictionary, /invites: "Convites pendentes"/);
  assert.match(dictionary, /open: "Convidar utilizador"/);
});

test("admin exposes the invite action in the shell toolbar", async () => {
  const toolbar = await read("packages/module-admin/src/ui/toolbar-controls.tsx");
  const events = await read("packages/module-admin/src/events.ts");

  assert.match(events, /openInvite: "admin:open-invite"/);
  assert.match(toolbar, /useShellActionReady\(ADMIN_EVENTS\.openInvite\)/);
  assert.match(toolbar, /dispatchShellAction\(ADMIN_EVENTS\.openInvite\)/);
  assert.match(toolbar, /dictionary\.invitations\.open/);
});

test("admin invitations have view-specific controls, explicit statuses, and pagination", async () => {
  const component = await read("packages/module-admin/src/ui/admin-users.tsx");
  const toolbar = await read("packages/module-admin/src/ui/toolbar-controls.tsx");
  const dictionary = await read("packages/module-admin/src/ui/dictionary.ts");

  assert.match(toolbar, /activeView === "invites" \? dictionary\.invitations\.searchPlaceholder/);
  assert.match(toolbar, /ADMIN_EVENTS\.setInvitationStatusFilter/);
  assert.match(component, /filteredInvitations/);
  assert.match(component, /visibleInvitations/);
  assert.match(component, /page=\{invitationPage\}/);
  assert.match(component, /<InvitationStatus invitation=\{invite\}/);
  assert.match(dictionary, /pending: "Pendente"/);
  assert.match(dictionary, /searchPlaceholder: "Procurar convites…"/);
  assert.match(dictionary, /pendingTitle: "Convites pendentes"/);
  assert.match(dictionary, /historyTitle: "Histórico de convites"/);
  assert.match(component, /invite\.status === "pending"/);
  assert.match(component, /invitationStatusFilter === "pending" \? dictionary\.invitations\.pendingTitle/);
});

test("admin invitations read organizations from the CRM list response", async () => {
  const client = await read("packages/module-admin/src/ui/client.ts");

  assert.match(client, /const collection = data && typeof data === "object" \? data : payload/);
  assert.match(client, /"items" in collection/);
});

test("preview mounts the live packaged admin page and routes", async () => {
  const overview = await read("apps/platform-preview/app/(shell)/admin/page.tsx");
  const users = await read("apps/platform-preview/app/(shell)/admin/users/page.tsx");
  const layout = await read("apps/platform-preview/app/(shell)/shell-layout-client.tsx");
  const toolbarConfig = await read("apps/platform-preview/config/module-toolbar-controls.tsx");
  const usersRoute = await read("apps/platform-preview/app/api/admin/users/route.ts");
  const invitationsRoute = await read("apps/platform-preview/app/api/admin/users/invitations/route.ts");
  const revokeRoute = await read("apps/platform-preview/app/api/admin/users/invitations/[invitationId]/route.ts");

  assert.match(overview, /redirect\("\/admin\/users"\)/);
  assert.match(users, /AdminUsersPage as default/);
  assert.match(usersRoute, /handleAdminUsersGetRequest/);
  assert.match(invitationsRoute, /handleAdminUserInvitationsGetRequest/);
  assert.match(invitationsRoute, /handleAdminUserInvitationsPostRequest/);
  assert.match(revokeRoute, /handleAdminUserInvitationDeleteRequest/);
  assert.match(layout, /AppShellFrame/);
  assert.match(layout, /getModuleToolbarControls\(pathname, toolbarRoutes\)/);
  assert.match(toolbarConfig, /AdminToolbarControls/);
  assert.match(toolbarConfig, /"admin-users"/);
});
