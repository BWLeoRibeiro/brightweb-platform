import assert from "node:assert/strict";
import test from "node:test";
import {
  applyShellRegistrationOverrides,
  buildClientAppShellRegistration,
  matchesShellPath,
  overrideNavHref,
  resolveShellToolbarSurface,
} from "../packages/app-shell/src/config.ts";
import { mergeDashboardRefreshEventDetails, normalizeDashboardRefreshSections } from "../packages/app-shell/src/dashboard/events.ts";
import type { ShellModuleRegistration, ShellToolbarRouteConfig } from "../packages/app-shell/src/types.ts";

test("matches exact and dynamic shell paths", () => {
  assert.equal(matchesShellPath("/projetos", { exact: ["/projetos"] }), true);
  assert.equal(matchesShellPath("/projetos/123/tarefas", { exact: ["/projetos/[id]/tarefas"] }), true);
  assert.equal(matchesShellPath("/projetos/123/tarefas/1", { exact: ["/projetos/[id]/tarefas"] }), false);
});

test("resolves the most specific overlapping toolbar prefix independent of route order", () => {
  const routes: ShellToolbarRouteConfig[] = [
    { surface: "projects", match: { prefixes: ["/projetos"] } },
    { surface: "project-board", match: { prefixes: ["/projetos/[id]/tarefas"] } },
  ];

  assert.equal(resolveShellToolbarSurface("/projetos/42/tarefas", routes), "project-board");
});

test("prefers an exact toolbar match over a matching prefix", () => {
  const routes: ShellToolbarRouteConfig[] = [
    { surface: "project-detail", match: { prefixes: ["/projetos"] } },
    { surface: "projects", match: { exact: ["/projetos"] } },
  ];

  assert.equal(resolveShellToolbarSurface("/projetos", routes), "projects");
});

test("resolves the MQ portfolio, project detail, and task-board overlap", () => {
  const routes: ShellToolbarRouteConfig[] = [
    { surface: "project-detail", match: { prefixes: ["/projetos/"] } },
    { surface: "projects", match: { exact: ["/projetos"] } },
    { surface: "project-board", match: { includes: ["/tarefas", "/quadro"] } },
  ];

  assert.equal(resolveShellToolbarSurface("/projetos", routes), "projects");
  assert.equal(resolveShellToolbarSurface("/projetos/42", routes), "project-detail");
  assert.equal(resolveShellToolbarSurface("/projetos/42/tarefas", routes), "project-board");
});

test("applies registration overrides without mutating input registrations", () => {
  const registration: ShellModuleRegistration = {
    key: "crm",
    moduleGroups: [{
      key: "crm",
      label: "CRM",
      icon: (() => null) as never,
      children: [{ href: "/admin/marketing", label: "Marketing", icon: (() => null) as never }],
    }],
    toolbarRoutes: [{ surface: "admin-marketing", match: { prefixes: ["/admin/marketing"] } }],
  };
  const originalSnapshot = structuredClone({
    moduleGroups: registration.moduleGroups?.map((group) => ({
      ...group,
      icon: undefined,
      children: group.children.map((item) => ({ ...item, icon: undefined })),
    })),
    toolbarRoutes: registration.toolbarRoutes,
  });

  const result = applyShellRegistrationOverrides([registration], {
    crm: (value) => overrideNavHref(value, "/admin/marketing", "/crm/marketing"),
  });

  assert.notEqual(result[0], registration);
  assert.equal(registration.moduleGroups?.[0]?.children[0]?.href, "/admin/marketing");
  assert.equal(registration.toolbarRoutes?.[0]?.match.prefixes?.[0], "/admin/marketing");
  assert.deepEqual({
    moduleGroups: registration.moduleGroups?.map((group) => ({
      ...group,
      icon: undefined,
      children: group.children.map((item) => ({ ...item, icon: undefined })),
    })),
    toolbarRoutes: registration.toolbarRoutes,
  }, originalSnapshot);
  assert.equal(result[0]?.moduleGroups?.[0]?.children[0]?.href, "/crm/marketing");
  assert.equal(result[0]?.toolbarRoutes?.[0]?.match.prefixes?.[0], "/crm/marketing");
});

test("warns about unknown registration override keys and lists known keys", () => {
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (message?: unknown) => warnings.push(String(message));

  try {
    applyShellRegistrationOverrides([{ key: "crm" }], { typo: (registration) => registration });
  } finally {
    console.warn = originalWarn;
  }

  assert.deepEqual(warnings, ["Unknown shell registration override keys: typo. Known keys: crm."]);
});

test("normalizes dashboard refresh sections", () => {
  assert.deepEqual(normalizeDashboardRefreshSections(), ["projects", "crm", "tasks"]);
  assert.deepEqual(normalizeDashboardRefreshSections([]), ["projects", "crm", "tasks"]);
  assert.deepEqual(normalizeDashboardRefreshSections(["tasks", "projects", "tasks"]), ["tasks", "projects"]);
});

test("merges dashboard refresh sections and keeps latest diagnostics", () => {
  assert.deepEqual(mergeDashboardRefreshEventDetails(
    { source: "realtime", domain: "projects", eventType: "project.updated", sections: ["projects", "tasks"] },
    { source: "realtime", domain: "crm", eventType: "contact.updated", sections: ["crm"] },
  ), { source: "realtime", domain: "crm", eventType: "contact.updated", sections: ["projects", "tasks", "crm"] });
  assert.deepEqual(mergeDashboardRefreshEventDetails(
    { source: "realtime", domain: "crm", eventType: "contact.updated", sections: ["crm"] },
    { source: "realtime", domain: "projects", eventType: "activity.created" },
  ), { source: "realtime", domain: "projects", eventType: "activity.created", sections: ["crm", "projects", "tasks"] });
});

test("builds dashboard contributions from enabled module registrations", () => {
  const built = buildClientAppShellRegistration({
    brand: {} as never,
    toolsSection: { key: "tools", label: "Tools", icon: (() => null) as never },
    modules: [
      { key: "projects", dashboardContribution: { key: "projects", sections: ["projects", "tasks"] } },
      { key: "crm", dashboardContribution: { key: "crm", sections: ["crm"] } },
    ],
  });
  assert.deepEqual(built.dashboardContributions.map((item) => item.sections), [["projects", "tasks"], ["crm"]]);
});
