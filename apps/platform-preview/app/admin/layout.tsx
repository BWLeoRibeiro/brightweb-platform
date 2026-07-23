"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  AppHeader,
  AppShellFrame,
  DesktopSidebar,
  MobileNav,
  computeInitials,
} from "@brightweblabs/app-shell";
import { AdminToolbarControls, defaultAdminUiDictionary } from "@brightweblabs/module-admin/ui";
import { Toaster } from "@brightweblabs/ui";

import { getStarterShellConfig } from "../../config/shell";
import { previewNotifications } from "../../config/notifications";

const mockUser = {
  email: "admin@starter-client.test",
  user_metadata: { first_name: "Starter", last_name: "Admin" },
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const { shellPreview: config, toolbarRoutes, toolbarActions } = getStarterShellConfig();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const displayName = "Starter Admin";

  return (
    <AppShellFrame
      collapsed={isSidebarCollapsed}
      sidebar={
        <DesktopSidebar
          brand={config.brand}
          isSidebarCollapsed={isSidebarCollapsed}
          isToolActive={config.toolsSection.items.some((item) => isActive(item.href))}
          toolsExpanded={toolsExpanded}
          visiblePrimaryNav={config.primaryNav}
          adminNavItem={config.adminNavItem}
          visibleToolNav={config.toolsSection.items}
          crmNavGroup={config.moduleGroups[0]}
          crmGroupExpanded
          isCrmGroupActive={false}
          isNavItemActive={isActive}
          isToolLinkActive={isActive}
          isCrmChildActive={isActive}
          onToggleSidebar={() => setIsSidebarCollapsed((current) => !current)}
          onToggleTools={() => setToolsExpanded((current) => !current)}
          onToggleCrmGroup={() => {}}
          account={{
            displayName,
            isStaff: true,
            onSignOut: async () => {},
            onThemeChange: () => {},
            user: mockUser,
            userInitials: computeInitials(displayName),
          }}
        />
      }
      header={
        <AppHeader
          kicker={defaultAdminUiDictionary.navigation.kicker}
          title={defaultAdminUiDictionary.navigation.title}
          pathname={pathname}
          toolbarRoutes={toolbarRoutes}
          toolbarActions={toolbarActions}
          notifications={{ notifications: previewNotifications, unreadCount: previewNotifications.length }}
        >
          {pathname === "/admin/users" ? <AdminToolbarControls /> : null}
        </AppHeader>
      }
      mobileNav={
        <MobileNav
          toolsExpanded={toolsExpanded}
          visiblePrimaryNav={config.primaryNav}
          visibleToolNav={config.toolsSection.items}
          isNavItemActive={isActive}
          isToolLinkActive={isActive}
          onToggleTools={() => setToolsExpanded((current) => !current)}
        />
      }
    >
      {children}
      <Toaster />
    </AppShellFrame>
  );
}
