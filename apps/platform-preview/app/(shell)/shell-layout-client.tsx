"use client";

import { useMemo, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AppHeader,
  AppShellFrame,
  DesktopSidebar,
  MobileNav,
  computeInitials,
  defaultDashboardDictionary,
  useShellNavState,
  type ShellContextualAction,
  type ShellNavStateGroup,
} from "@brightweblabs/app-shell";
import { createAuthUiClient } from "@brightweblabs/core-auth/ui";
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

export type ShellViewer = {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  isAdmin: boolean;
  isStaff: boolean;
};

const authClient = createAuthUiClient();

export function PreviewShellLayoutClient({
  children,
  viewer,
}: Readonly<{ children: ReactNode; viewer: ShellViewer }>) {
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
  const isAdminSurface = pathname === "/admin" || pathname.startsWith("/admin/");
  const usesToasts = isAdminSurface || pathname === "/account";
  const isActive = (href: string) => pathname === href
    || (isAdminSurface && pathname.startsWith(`${href}/`));
  const displayName = [viewer.firstName, viewer.lastName].filter(Boolean).join(" ")
    || viewer.email
    || "Conta";
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
    toolbarControls = pathname === "/crm" ? <CrmToolbarControls /> : null;
  } else if (pathname === "/projects" || pathname.startsWith("/projects/")) {
    kicker = projectId ? projectHeader.projectKicker : projectHeader.portfolioKicker;
    title = isProjectBoard
      ? projectHeader.tasksTitle
      : projectId
        ? projectHeader.detailTitle
        : projectHeader.portfolioTitle;
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
          adminNavItem={viewer.isAdmin ? config.adminNavItem : null}
          visibleToolNav={config.toolsSection.items}
          navGroups={config.moduleGroups}
          isNavGroupExpanded={isGroupOpen}
          isNavGroupActive={(group) => group.children.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))}
          isNavItemActive={isActive}
          isToolLinkActive={isActive}
          onToggleSidebar={toggleSidebar}
          onToggleTools={() => toggleGroup(config.toolsSection.key)}
          onToggleNavGroup={toggleGroup}
          account={{
            displayName,
            isStaff: viewer.isStaff,
            onSignOut: async () => {
              await authClient.signOutLocal();
              router.replace("/login");
              router.refresh();
            },
            onThemeChange: isAdminSurface ? () => {} : undefined,
            user: {
              email: viewer.email,
              user_metadata: {
                first_name: viewer.firstName,
                last_name: viewer.lastName,
              },
            },
            userInitials: computeInitials(viewer.email, viewer.firstName ?? undefined, viewer.lastName ?? undefined),
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
          adminNavItem={viewer.isAdmin ? config.adminNavItem : null}
          visibleToolNav={config.toolsSection.items}
          navGroups={config.moduleGroups}
          isNavItemActive={isActive}
          isToolLinkActive={isActive}
          onToggleTools={() => toggleGroup(config.toolsSection.key)}
        />
      }
    >
      {children}
      {usesToasts ? <Toaster /> : null}
    </AppShellFrame>
  );
}
