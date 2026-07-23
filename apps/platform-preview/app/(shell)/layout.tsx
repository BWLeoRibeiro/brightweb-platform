"use client";

import { useMemo, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Users } from "lucide-react";
import {
  AppHeader,
  AppShellFrame,
  DesktopSidebar,
  MobileNav,
  computeInitials,
  defaultDashboardDictionary,
  getShellNavGroup,
  useShellNavState,
  type NavGroupConfig,
  type ShellContextualAction,
  type ShellNavStateGroup,
} from "@brightweblabs/app-shell";
import "@brightweblabs/app-shell/dashboard.css";
import { AdminToolbarControls, defaultAdminUiDictionary } from "@brightweblabs/module-admin/ui";
import { CrmToolbarControls } from "@brightweblabs/module-crm/ui";
import "@brightweblabs/module-crm/tokens.css";
import {
  defaultProjectsUiDictionary,
  ProjectsToolbarControls,
} from "@brightweblabs/module-projects/ui";
import "@brightweblabs/module-projects/tokens.css";
import { Toaster } from "@brightweblabs/ui";

import { getStarterShellConfig } from "../../config/shell";
import { previewNotifications } from "../../config/notifications";
import { projects } from "./projects/mock-data";

const mockUser = {
  email: "admin@starter-client.test",
  user_metadata: { first_name: "Starter", last_name: "Admin" },
};

export default function PreviewShellLayout({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const { shellPreview: config, toolbarRoutes, toolbarActions } = useMemo(
    () => getStarterShellConfig(),
    [],
  );
  const shellGroups = useMemo<ShellNavStateGroup[]>(
    () => [
      { key: config.toolsSection.key, items: config.toolsSection.items },
      ...config.moduleGroups.map((group) => ({ key: group.key, items: group.children })),
    ],
    [config],
  );
  const {
    isSidebarCollapsed,
    isGroupOpen,
    toggleGroup,
    toggleSidebar,
  } = useShellNavState({ pathname, groups: shellGroups });
  const registeredCrmNavGroup = getShellNavGroup(config, "crm");
  const crmNavGroup = registeredCrmNavGroup ?? ({
    label: "CRM",
    icon: Users,
    children: [],
  } satisfies NavGroupConfig);
  const crmGroupKey = registeredCrmNavGroup?.key ?? "crm";
  const isAdminSurface = pathname === "/admin" || pathname.startsWith("/admin/");
  const isActive = (href: string) => pathname === href
    || (isAdminSurface && pathname.startsWith(`${href}/`));
  const displayName = "Starter Admin";
  const projectId = pathname.startsWith("/projects/") ? pathname.split("/")[2] : undefined;
  const isProjectBoard = pathname.endsWith("/board") || pathname.endsWith("/tasks");
  const projectHeader = defaultProjectsUiDictionary.header;

  let kicker = "";
  let title = "";
  let count: number | undefined;
  let toolbarControls: ReactNode = null;

  if (pathname === "/dashboard") {
    kicker = defaultDashboardDictionary.header.kicker;
    title = defaultDashboardDictionary.header.title;
  } else if (pathname === "/crm" || pathname.startsWith("/crm/")) {
    kicker = "Relações";
    title = pathname === "/crm/report" ? "Relatórios" : "CRM";
    count = pathname === "/crm" ? 5 : undefined;
    toolbarControls = pathname === "/crm" ? <CrmToolbarControls /> : null;
  } else if (pathname === "/projects" || pathname.startsWith("/projects/")) {
    kicker = projectId ? projectHeader.projectKicker : projectHeader.portfolioKicker;
    title = isProjectBoard
      ? projectHeader.tasksTitle
      : projectId
        ? projectHeader.detailTitle
        : projectHeader.portfolioTitle;
    count = pathname === "/projects" ? projects.length : undefined;
    toolbarControls = pathname === "/projects" ? <ProjectsToolbarControls /> : null;
  } else if (isAdminSurface) {
    kicker = defaultAdminUiDictionary.navigation.kicker;
    title = defaultAdminUiDictionary.navigation.title;
    toolbarControls = pathname === "/admin/users" ? <AdminToolbarControls /> : null;
  }

  const handleToolbarAction = (item: ShellContextualAction) => {
    if (item.action === "projects-back-to-portfolio") router.push("/projects");
    if (item.action === "projects-open-board" && projectId) {
      router.push(`/projects/${projectId}/tasks`);
    }
  };

  return (
    <AppShellFrame
      collapsed={isSidebarCollapsed}
      sidebar={
        <DesktopSidebar
          brand={config.brand}
          isSidebarCollapsed={isSidebarCollapsed}
          isToolActive={config.toolsSection.items.some((item) => isActive(item.href))}
          toolsExpanded={isGroupOpen(config.toolsSection.key)}
          visiblePrimaryNav={config.primaryNav}
          adminNavItem={config.adminNavItem}
          visibleToolNav={config.toolsSection.items}
          crmNavGroup={crmNavGroup}
          crmGroupExpanded={isGroupOpen(crmGroupKey)}
          isCrmGroupActive={crmNavGroup.children.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))}
          isNavItemActive={isActive}
          isToolLinkActive={isActive}
          isCrmChildActive={isActive}
          onToggleSidebar={toggleSidebar}
          onToggleTools={() => toggleGroup(config.toolsSection.key)}
          onToggleCrmGroup={() => toggleGroup(crmGroupKey)}
          account={{
            displayName,
            isStaff: true,
            onSignOut: async () => {},
            onThemeChange: isAdminSurface ? () => {} : undefined,
            user: mockUser,
            userInitials: computeInitials(displayName),
          }}
        />
      }
      header={
        <AppHeader
          kicker={kicker}
          title={title}
          count={count}
          pathname={pathname}
          toolbarRoutes={toolbarRoutes}
          toolbarActions={toolbarActions}
          onToolbarAction={handleToolbarAction}
          notifications={{
            notifications: previewNotifications,
            unreadCount: previewNotifications.length,
          }}
        >
          {toolbarControls}
        </AppHeader>
      }
      mobileNav={
        <MobileNav
          toolsExpanded={isGroupOpen(config.toolsSection.key)}
          visiblePrimaryNav={config.primaryNav}
          visibleToolNav={config.toolsSection.items}
          isNavItemActive={isActive}
          isToolLinkActive={isActive}
          onToggleTools={() => toggleGroup(config.toolsSection.key)}
        />
      }
    >
      {children}
      {isAdminSurface ? <Toaster /> : null}
    </AppShellFrame>
  );
}
