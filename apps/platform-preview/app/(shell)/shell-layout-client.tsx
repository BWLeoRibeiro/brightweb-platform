"use client";

import { useMemo, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AppHeader,
  AppShellFrame,
  DesktopSidebar,
  MobileNav,
  ShellActionsProvider,
  ShellRealtimeBridge,
  computeInitials,
  isShellNavItemActive,
  useShellAction,
  useShellActionDispatch,
  useShellNotifications,
  useShellNavState,
  type ShellContextualAction,
  type ShellNavStateGroup,
} from "@brightweblabs/app-shell";
import { createAuthUiClient } from "@brightweblabs/core-auth/ui";
import "@brightweblabs/app-shell/dashboard.css";
import "@brightweblabs/module-crm/tokens.css";
import "@brightweblabs/module-projects/tokens.css";

import { getModuleToolbarControls } from "../../config/module-toolbar-controls";
import { getStarterShellConfig } from "../../config/shell";

export type ShellViewer = {
  profileId: string | null;
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
  return (
    <ShellActionsProvider>
      <PreviewShellLayoutInner viewer={viewer}>{children}</PreviewShellLayoutInner>
    </ShellActionsProvider>
  );
}

function PreviewShellLayoutInner({
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
  const notifications = useShellNotifications({ enabled: viewer.isStaff });
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
  const displayName = [viewer.firstName, viewer.lastName].filter(Boolean).join(" ")
    || viewer.email
    || "Conta";
  const projectsBaseHref = pathname.startsWith("/projects") ? "/projects" : "/projetos";
  const toolbarControls = getModuleToolbarControls(pathname, toolbarRoutes);

  const dispatchShellAction = useShellActionDispatch();
  useShellAction("projects-back-to-portfolio", () => {
    router.push(projectsBaseHref);
  });
  useShellAction("projects-open-board", () => {
    const projectId = pathname.split("/")[2];
    if (projectId) {
      router.push(`${projectsBaseHref}/${projectId}/${projectsBaseHref === "/projects" ? "tasks" : "tarefas"}`);
    }
  });

  const handleToolbarAction = (item: ShellContextualAction) => {
    if (item.action) dispatchShellAction(item.action);
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
          title={activeNavItem?.label}
          pathname={pathname}
          toolbarRoutes={toolbarRoutes}
          toolbarActions={toolbarActions}
          onToolbarAction={handleToolbarAction}
          notifications={viewer.isStaff ? notifications : undefined}
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
      <ShellRealtimeBridge viewer={viewer} />
      {children}
    </AppShellFrame>
  );
}
