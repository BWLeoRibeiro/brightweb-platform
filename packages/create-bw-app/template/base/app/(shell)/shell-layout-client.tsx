"use client";

import { useMemo, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AppHeader,
  AppShellFrame,
  DesktopSidebar,
  MobileNav,
  computeInitials,
  isShellNavItemActive,
  useShellNavState,
  type ShellContextualAction,
  type ShellNavStateGroup,
} from "@brightweblabs/app-shell";
import { createAuthUiClient } from "@brightweblabs/core-auth/ui";
import { Toaster } from "@brightweblabs/ui";
import { getStarterShellConfig } from "../../config/shell";
import "@brightweblabs/app-shell/dashboard.css";

export type ShellViewer = {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  isAdmin: boolean;
  isStaff: boolean;
};

const authClient = createAuthUiClient();
const toolbarWindowEventByAction: Record<string, string> = {
  "projects-refresh": "projects:refresh",
  "projects-new-menu": "projects:open-new-project",
  "crm-create-menu": "brightweb:crm:create-contact",
};

export function ShellLayoutClient({
  children,
  viewer,
}: Readonly<{ children: ReactNode; viewer: ShellViewer }>) {
  const pathname = usePathname() ?? "";
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
  const { isSidebarCollapsed, isGroupOpen, toggleGroup, toggleSidebar } =
    useShellNavState({ pathname, groups: shellGroups });
  const isAdminSurface = pathname === "/admin" || pathname.startsWith("/admin/");
  const shellNavItems = [
    ...config.primaryNav,
    ...(config.adminNavItem ? [config.adminNavItem] : []),
    ...config.toolsSection.items,
    ...config.moduleGroups.flatMap((group) => group.children),
  ];
  const activeNavItem = shellNavItems.reduce<(typeof shellNavItems)[number] | undefined>(
    (active, item) => isShellNavItemActive(pathname, item)
      && (!active || item.href.length > active.href.length)
      ? item
      : active,
    undefined,
  );
  const isActive = (href: string) => activeNavItem?.href === href;
  const displayName =
    [viewer.firstName, viewer.lastName].filter(Boolean).join(" ") ||
    viewer.email ||
    "Conta";
  const projectsBaseHref = pathname.startsWith("/projects") ? "/projects" : "/projetos";

  const handleToolbarAction = (item: ShellContextualAction) => {
    if (item.action === "projects-back-to-portfolio") {
      router.push(projectsBaseHref);
      return;
    }
    if (item.action === "projects-open-board") {
      const projectId = pathname.split("/")[2];
      if (projectId) {
        router.push(`${projectsBaseHref}/${projectId}/${projectsBaseHref === "/projects" ? "tasks" : "tarefas"}`);
      }
      return;
    }

    if (item.action) {
      window.dispatchEvent(new Event(toolbarWindowEventByAction[item.action] ?? item.action));
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
          isNavGroupActive={(group) => group.children.some(
            (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
          )}
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
            user: {
              email: viewer.email,
              user_metadata: {
                first_name: viewer.firstName,
                last_name: viewer.lastName,
              },
            },
            userInitials: computeInitials(
              viewer.email,
              viewer.firstName ?? undefined,
              viewer.lastName ?? undefined,
            ),
          }}
        />
      }
      header={
        <AppHeader
          title={activeNavItem?.label}
          pathname={pathname}
          toolbarRoutes={toolbarRoutes}
          toolbarActions={toolbarActions}
          onToolbarAction={handleToolbarAction}
        >
          {null}
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
      {isAdminSurface || pathname === "/account" ? <Toaster /> : null}
    </AppShellFrame>
  );
}
