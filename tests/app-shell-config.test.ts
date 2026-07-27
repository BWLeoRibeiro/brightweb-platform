import assert from "node:assert/strict";
import test from "node:test";
import { isValidElement, type ReactNode } from "react";
import {
  applyShellRegistrationOverrides,
  buildClientAppShellRegistration,
  matchesShellPath,
  overrideNavHref,
  resolveClientAppShellConfig,
  resolveShellToolbarSurface,
} from "../packages/app-shell/src/config.ts";
import { DesktopSidebar } from "../packages/app-shell/src/components/desktop-sidebar.tsx";
import { MobileNav } from "../packages/app-shell/src/components/mobile-nav.tsx";
import { MobileNavPill, SidebarSectionToggle } from "../packages/app-shell/src/components/nav-primitives.tsx";
import { mergeDashboardRefreshEventDetails, normalizeDashboardRefreshSections } from "../packages/app-shell/src/dashboard/events.ts";
import type {
  NavGroupConfig,
  ShellBrand,
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
