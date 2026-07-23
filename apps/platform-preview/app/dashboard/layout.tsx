"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Users } from "lucide-react";
import { AppHeader, AppShellFrame, DesktopSidebar, MobileNav, computeInitials, defaultDashboardDictionary, getShellNavGroup, type NavGroupConfig } from "@brightweblabs/app-shell";
import "@brightweblabs/app-shell/dashboard.css";
import { getStarterShellConfig } from "../../config/shell";
import { previewNotifications } from "../../config/notifications";

const mockUser = { email: "admin@starter-client.test", user_metadata: { first_name: "Starter", last_name: "Admin" } };

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const { shellPreview: config, toolbarRoutes, toolbarActions } = getStarterShellConfig();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [crmExpanded, setCrmExpanded] = useState(false);
  const crmNavGroup = useMemo(() => getShellNavGroup(config, "crm") ?? ({ label: "CRM", icon: Users, children: [] } satisfies NavGroupConfig), [config]);
  const isActive = (href: string) => href === pathname;
  const displayName = "Starter Admin";

  return <AppShellFrame
    collapsed={isSidebarCollapsed}
    sidebar={<DesktopSidebar brand={config.brand} isSidebarCollapsed={isSidebarCollapsed} isToolActive={config.toolsSection.items.some((item) => isActive(item.href))} toolsExpanded={toolsExpanded} visiblePrimaryNav={config.primaryNav} adminNavItem={config.adminNavItem} visibleToolNav={config.toolsSection.items} crmNavGroup={crmNavGroup} crmGroupExpanded={crmExpanded} isCrmGroupActive={pathname.startsWith("/crm")} isNavItemActive={isActive} isToolLinkActive={isActive} isCrmChildActive={isActive} onToggleSidebar={() => setIsSidebarCollapsed((value) => !value)} onToggleTools={() => setToolsExpanded((value) => !value)} onToggleCrmGroup={() => setCrmExpanded((value) => !value)} account={{ displayName, isStaff: true, onSignOut: async () => {}, user: mockUser, userInitials: computeInitials(displayName) }} />}
    header={<AppHeader kicker={defaultDashboardDictionary.header.kicker} title={defaultDashboardDictionary.header.title} pathname={pathname} toolbarRoutes={toolbarRoutes} toolbarActions={toolbarActions} notifications={{ notifications: previewNotifications, unreadCount: previewNotifications.length }} />}
    mobileNav={<MobileNav toolsExpanded={toolsExpanded} visiblePrimaryNav={config.primaryNav} visibleToolNav={config.toolsSection.items} isNavItemActive={isActive} isToolLinkActive={isActive} onToggleTools={() => setToolsExpanded((value) => !value)} />}
  >{children}</AppShellFrame>;
}
