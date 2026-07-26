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
  getShellNavGroup,
  useShellNavState,
  type NavGroupConfig,
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
  const registeredCrmNavGroup = getShellNavGroup(config, "crm");
  const crmNavGroup = registeredCrmNavGroup ?? ({
    label: "CRM",
    icon: Users,
    children: [],
  } satisfies NavGroupConfig);
  const crmGroupKey = registeredCrmNavGroup?.key ?? "crm";
  const isAdminSurface = pathname === "/admin" || pathname.startsWith("/admin/");
  const isActive = (href: string) =>
    pathname === href || (isAdminSurface && pathname.startsWith(`${href}/`));
  const displayName =
    [viewer.firstName, viewer.lastName].filter(Boolean).join(" ") ||
    viewer.email ||
    "Conta";

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
          crmNavGroup={crmNavGroup}
          crmGroupExpanded={isGroupOpen(crmGroupKey)}
          isCrmGroupActive={crmNavGroup.children.some(
            (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
          )}
          isNavItemActive={isActive}
          isToolLinkActive={isActive}
          isCrmChildActive={isActive}
          onToggleSidebar={toggleSidebar}
          onToggleTools={() => toggleGroup(config.toolsSection.key)}
          onToggleCrmGroup={() => toggleGroup(crmGroupKey)}
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
          pathname={pathname}
          toolbarRoutes={toolbarRoutes}
          toolbarActions={toolbarActions}
        />
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
      {isAdminSurface || pathname === "/account" ? <Toaster /> : null}
    </AppShellFrame>
  );
}
