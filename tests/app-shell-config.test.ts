import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement as h, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  applyShellRegistrationOverrides,
  buildClientAppShellRegistration,
  matchesShellPath,
  overrideNavHref,
  resolveClientAppShellConfig,
  resolveShellToolbarSurface,
} from "../packages/app-shell/src/config.ts";
import { AppHeader, AppHeaderToolbarActionButton, type AppHeaderToolbarActionButtonProps } from "../packages/app-shell/src/components/app-header.tsx";
import { AlertsMenu, AlertsMenuContent } from "../packages/app-shell/src/components/alerts-menu.tsx";
import { triggerShellToolbarAction } from "../packages/app-shell/src/lib/shell-actions.tsx";
import { ShellActionRegistry } from "../packages/app-shell/src/lib/shell-action-registry.ts";
import { DesktopSidebar } from "../packages/app-shell/src/components/desktop-sidebar.tsx";
import { MobileNav } from "../packages/app-shell/src/components/mobile-nav.tsx";
import { MobileNavPill, SidebarSectionToggle } from "../packages/app-shell/src/components/nav-primitives.tsx";
import { mergeDashboardRefreshEventDetails, normalizeDashboardRefreshSections } from "../packages/app-shell/src/dashboard/events.ts";
import {
  getProjectRouteContext,
  getRealtimeProjectId,
  getRealtimeProjectRoutePayloads,
  isRealtimeProjectAccessRemoved,
  isRealtimeProjectDeleted,
} from "../packages/app-shell/src/realtime.tsx";
import type { AppActivityRealtimePayload } from "../packages/infra/src/realtime.ts";
import type {
  NavGroupConfig,
  ShellBrand,
  ShellContextualAction,
  ShellModuleRegistration,
  ShellToolbarRouteConfig,
} from "../packages/app-shell/src/types.ts";

function collectElementProps(node: ReactNode, elementType: unknown): Record<string, unknown>[] {
  const matches: Record<string, unknown>[] = [];

  function visit(value: ReactNode) {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (!isValidElement(value)) return;

    const props = value.props as Record<string, unknown> & { children?: ReactNode };
    if (value.type === elementType) matches.push(props);
    visit(props.children);
  }

  visit(node);
  return matches;
}

const TestNavIcon = (() => null) as NavGroupConfig["icon"];
const testShellBrand = {
  href: "/",
  ariaLabel: "Test home",
  alt: "Test",
  collapsedLogo: { src: "/collapsed.svg", width: 32, height: 32 },
  lightLogo: { src: "/light.svg", width: 120, height: 32 },
  darkLogo: { src: "/dark.svg", width: 120, height: 32 },
} satisfies ShellBrand;

function realtimePayload(
  eventType: string,
  payload: Record<string, unknown> = {},
): AppActivityRealtimePayload {
  return {
    commit_timestamp: "2026-07-31T12:00:00.000Z",
    errors: null,
    eventType: "INSERT",
    new: {
      id: "event-1",
      created_at: "2026-07-31T12:00:00.000Z",
      domain: "projects",
      event_type: eventType,
      entity_table: "projects",
      entity_id: "project-1",
      actor_profile_id: "profile-1",
      summary: "Project changed",
      payload,
    },
    old: {},
    schema: "public",
    table: "app_activity_events",
  };
}

test("realtime routing covers staff and account project surfaces", () => {
  assert.deepEqual(getProjectRouteContext("/projetos"), {
    baseHref: "/projetos",
    projectId: null,
    surface: "portfolio",
  });
  assert.deepEqual(getProjectRouteContext("/projects/project-1/tasks"), {
    baseHref: "/projects",
    projectId: "project-1",
    surface: "detail",
  });
  assert.deepEqual(getProjectRouteContext("/account/projetos/project-1"), {
    baseHref: "/account/projetos",
    projectId: "project-1",
    surface: "detail",
  });
  assert.equal(getProjectRouteContext("/crm"), null);
});

test("realtime project events preserve project and access-loss semantics", () => {
  const update = realtimePayload("task_updated", { project_id: "project-2" });
  assert.equal(getRealtimeProjectId(update), "project-2");
  assert.equal(isRealtimeProjectDeleted(update), false);

  const deleted = realtimePayload("projects.project.deleted", { project_id: "project-1" });
  assert.equal(isRealtimeProjectDeleted(deleted), true);

  const removed = realtimePayload("member_removed", { profile_id: "profile-2" });
  assert.equal(isRealtimeProjectAccessRemoved(removed, "profile-2"), true);
  assert.equal(isRealtimeProjectAccessRemoved(removed, "profile-3"), false);

  const synced = realtimePayload("project_members_synced", {
    removed_profile_ids: ["profile-3"],
  });
  assert.equal(isRealtimeProjectAccessRemoved(synced, "profile-3"), true);

  const otherProject = realtimePayload("task_updated", { project_id: "project-9" });
  assert.deepEqual(
    getRealtimeProjectRoutePayloads([update, otherProject, removed], "project-2"),
    [update],
  );
});

test("shell realtime retains MQ notification and surface-refresh parity", () => {
  const source = readFileSync(
    new URL("../packages/app-shell/src/realtime.tsx", import.meta.url),
    "utf8",
  );
  for (const pattern of [
    /NOTIFICATIONS_REALTIME_REFRESH_EVENT/,
    /payload\.new\.domain === "crm"/,
    /CRM_REALTIME_REFRESH_EVENT/,
    /payload\.new\.domain === "admin"/,
    /ADMIN_REALTIME_REFRESH_EVENT/,
    /payload\.new\.domain === "projects"/,
    /PROJECTS_REALTIME_REFRESH_EVENT/,
    /DASHBOARD_EVENTS\.refresh/,
    /router\.refresh\(\)/,
    /router\.replace\(route\.baseHref\)/,
    /APP_ACTIVITY_REALTIME_EVENT/,
  ]) {
    assert.match(source, pattern);
  }

  const notificationsSource = readFileSync(
    new URL("../packages/app-shell/src/use-shell-notifications.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(notificationsSource, /\.channel\(/);
  assert.match(notificationsSource, /NOTIFICATIONS_REALTIME_REFRESH_EVENT/);
  assert.match(notificationsSource, /summaryRefreshQueuedRef/);
  assert.match(notificationsSource, /itemsRefreshQueuedRef/);
});

test("lazy project creation surfaces register authoritative shell actions before mounting", () => {
  const source = readFileSync(
    new URL("../packages/module-projects/src/ui/projects-portfolio/projects-portfolio-modals.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /useShellAction\(PROJECTS_EVENTS\.openNewProject/);
  assert.match(source, /useShellAction\(PROJECTS_EVENTS\.openNewTask/);
  assert.doesNotMatch(source, /useWindowEventBridge/);
});

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

test("resolves English project task boards without leaking collection controls", () => {
  const routes: ShellToolbarRouteConfig[] = [
    { surface: "project-board", match: { includes: ["/tarefas", "/tasks", "/quadro"] } },
    { surface: "project-detail", match: { prefixes: ["/projects/"] } },
    { surface: "projects", match: { exact: ["/projects"] } },
  ];

  assert.equal(resolveShellToolbarSurface("/projects", routes), "projects");
  assert.equal(resolveShellToolbarSurface("/projects/42", routes), "project-detail");
  assert.equal(resolveShellToolbarSurface("/projects/42/tasks", routes), "project-board");
});

test("AppHeader renders and dispatches unplaced toolbar actions without a title", () => {
  const dispatched: string[] = [];
  const actions: ShellContextualAction[] = [
    { label: "Atualizar", icon: TestNavIcon, action: "projects-refresh" },
    { label: "Novo", icon: TestNavIcon, action: "projects-new-menu" },
  ];
  const header = AppHeader({
    pathname: "/projetos",
    toolbarRoutes: [{ surface: "projects", match: { exact: ["/projetos"] } }],
    toolbarActions: { projects: actions },
    onToolbarAction: (action) => dispatched.push(action.action ?? ""),
  });
  const buttons = collectElementProps(header, AppHeaderToolbarActionButton) as AppHeaderToolbarActionButtonProps[];

  assert.equal(header.type, "div");
  assert.deepEqual(buttons.map((props) => props.action.label), ["Atualizar", "Novo"]);
  // Without a shell action registry the buttons fall back to onToolbarAction.
  for (const props of buttons) triggerShellToolbarAction(null, props.action, props.onToolbarAction);
  assert.deepEqual(dispatched, ["projects-refresh", "projects-new-menu"]);
});

test("AppHeader mounts notifications in its header utility slot", () => {
  const header = AppHeader({
    title: "Dashboard",
    notifications: {
      unreadCount: 2,
      notifications: [],
    },
  });
  const menus = collectElementProps(header, AlertsMenu);

  assert.equal(menus.length, 1);
  assert.equal(menus[0]?.unreadCount, 2);
});

test("notification menu exposes stable loading, error, empty, unread, and actor states", () => {
  const loading = renderToStaticMarkup(h(AlertsMenuContent, { notifications: [], loading: true, unreadCount: 0 }));
  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /A carregar alertas/);

  const error = renderToStaticMarkup(h(AlertsMenuContent, { notifications: [], loading: false, unreadCount: 0, error: "Falha ao carregar" }));
  assert.match(error, /role="alert"/);
  assert.match(error, /Falha ao carregar/);

  const empty = renderToStaticMarkup(h(AlertsMenuContent, { notifications: [], loading: false, unreadCount: 0 }));
  assert.match(empty, /Sem alertas novos/);
  assert.match(empty, /Está tudo em dia/);

  const unread = renderToStaticMarkup(h(AlertsMenuContent, {
    loading: false,
    unreadCount: 12,
    notifications: [{
      id: "event-1",
      summary: "criou um contacto",
      createdAt: "2026-07-31T10:00:00.000Z",
      domain: "crm",
      actorLabel: "Grace Hopper",
    }],
  }));
  assert.match(unread, />9\+ novas</);
  assert.match(unread, /Grace Hopper/);
  assert.match(unread, />CRM</);
});

test("toolbar actions invoke registered shell action handlers instead of the window-event fallback", () => {
  const registry = new ShellActionRegistry({ "projects-refresh": "projects:refresh" });
  const invoked: string[] = [];
  const fallback: string[] = [];
  registry.register("projects:refresh", () => invoked.push("projects:refresh"));

  const refresh: ShellContextualAction = { label: "Atualizar", icon: TestNavIcon, action: "projects-refresh" };
  const unregistered: ShellContextualAction = { label: "Novo", icon: TestNavIcon, action: "projects-new-menu" };

  triggerShellToolbarAction(registry, refresh, (action) => fallback.push(action.action ?? ""));
  triggerShellToolbarAction(registry, unregistered, (action) => fallback.push(action.action ?? ""));

  assert.deepEqual(invoked, ["projects:refresh"]);
  assert.deepEqual(fallback, ["projects-new-menu"]);
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

test("renders every resolved module nav group in registration order", () => {
  const built = buildClientAppShellRegistration({
    brand: testShellBrand,
    toolsSection: { key: "tools", label: "Tools", icon: TestNavIcon },
    modules: [
      {
        key: "crm",
        moduleGroups: [{
          key: "crm",
          label: "CRM",
          icon: TestNavIcon,
          children: [{ href: "/crm", label: "Contacts", icon: TestNavIcon }],
        }],
      },
      {
        key: "marketing",
        moduleGroups: [{
          key: "marketing",
          label: "Marketing",
          icon: TestNavIcon,
          children: [{
            href: "/marketing",
            label: "Campaigns",
            icon: TestNavIcon,
            visibility: "staff",
          }],
        }],
      },
    ],
  });
  const config = resolveClientAppShellConfig(built.shellConfig, {
    isAdmin: false,
    isStaff: true,
  });

  assert.deepEqual(config.moduleGroups.map((group) => group.key), ["crm", "marketing"]);

  const sidebar = DesktopSidebar({
    brand: config.brand,
    isSidebarCollapsed: false,
    isToolActive: false,
    toolsExpanded: false,
    visiblePrimaryNav: config.primaryNav,
    adminNavItem: config.adminNavItem,
    visibleToolNav: config.toolsSection.items,
    navGroups: config.moduleGroups,
    isNavGroupExpanded: () => true,
    isNavGroupActive: () => false,
    isNavItemActive: () => false,
    isToolLinkActive: () => false,
    onToggleSidebar: () => {},
    onToggleTools: () => {},
    onToggleNavGroup: () => {},
  });
  const groupToggles = collectElementProps(sidebar, SidebarSectionToggle);

  assert.deepEqual(
    groupToggles.map((props) => props.label),
    ["CRM", "Marketing"],
  );
  assert.deepEqual(
    groupToggles.map((props) => props.controlsId),
    ["crm-nav-desktop", "marketing-nav-desktop"],
  );
});

test("renders every resolved module nav group in the mobile nav in registration order", () => {
  const built = buildClientAppShellRegistration({
    brand: testShellBrand,
    toolsSection: { key: "tools", label: "Tools", icon: TestNavIcon },
    modules: [
      {
        key: "crm",
        moduleGroups: [{
          key: "crm",
          label: "CRM",
          icon: TestNavIcon,
          children: [{ href: "/crm", label: "Contacts", icon: TestNavIcon }],
        }],
      },
      {
        key: "marketing",
        moduleGroups: [{
          key: "marketing",
          label: "Marketing",
          icon: TestNavIcon,
          children: [{ href: "/marketing", label: "Campaigns", icon: TestNavIcon }],
        }],
      },
    ],
  });
  const config = resolveClientAppShellConfig(built.shellConfig, {
    isAdmin: false,
    isStaff: true,
  });

  const mobileNav = MobileNav({
    toolsExpanded: false,
    visiblePrimaryNav: config.primaryNav,
    visibleToolNav: config.toolsSection.items,
    navGroups: config.moduleGroups,
    isNavItemActive: () => false,
    isToolLinkActive: () => false,
    onToggleTools: () => {},
  });
  const groupHeadings = collectElementProps(mobileNav, "p");
  const groupPills = collectElementProps(mobileNav, MobileNavPill);

  assert.deepEqual(groupHeadings.map((props) => props.children), ["CRM", "Marketing"]);
  assert.deepEqual(groupPills.map((props) => props.href), ["/crm", "/marketing"]);
});

test("renders the resolved admin item in the mobile nav", () => {
  const built = buildClientAppShellRegistration({
    brand: testShellBrand,
    toolsSection: { key: "tools", label: "Tools", icon: TestNavIcon },
    modules: [{
      key: "admin",
      placement: "admin",
      navItems: [{
        href: "/admin/users",
        label: "Painel de Administração",
        icon: TestNavIcon,
      }],
    }],
  });
  const config = resolveClientAppShellConfig(built.shellConfig, {
    isAdmin: true,
    isStaff: true,
  });

  const mobileNav = MobileNav({
    toolsExpanded: false,
    visiblePrimaryNav: config.primaryNav,
    adminNavItem: config.adminNavItem,
    visibleToolNav: config.toolsSection.items,
    navGroups: config.moduleGroups,
    isNavItemActive: (href) => href === "/admin/users",
    isToolLinkActive: () => false,
    onToggleTools: () => {},
  });
  const pills = collectElementProps(mobileNav, MobileNavPill);

  assert.deepEqual(
    pills.map(({ href, label, active }) => ({ href, label, active })),
    [{
      href: "/admin/users",
      label: "Painel de Administração",
      active: true,
    }],
  );
});

test("drops a module nav group when viewer visibility filters out every child", () => {
  const config = resolveClientAppShellConfig({
    brand: testShellBrand,
    primaryNav: [],
    toolsSection: { key: "tools", label: "Tools", icon: TestNavIcon, items: [] },
    moduleGroups: [
      {
        key: "crm",
        label: "CRM",
        icon: TestNavIcon,
        children: [{ href: "/crm", label: "Contacts", icon: TestNavIcon }],
      },
      {
        key: "marketing",
        label: "Marketing",
        icon: TestNavIcon,
        children: [{
          href: "/marketing",
          label: "Campaigns",
          icon: TestNavIcon,
          visibility: "staff",
        }],
      },
    ],
  }, {
    isAdmin: false,
    isStaff: false,
  });

  assert.deepEqual(config.moduleGroups.map((group) => group.key), ["crm"]);
});
