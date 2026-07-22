"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Users } from "lucide-react";
import {
  AppHeader,
  AppShellFrame,
  DesktopSidebar,
  MobileNav,
  computeInitials,
  getShellNavGroup,
  type NavGroupConfig,
  type ResolvedClientAppShellConfig,
} from "@brightweblabs/app-shell";
import { CrmToolbarControls } from "@brightweblabs/module-crm/ui";
import "@brightweblabs/module-crm/tokens.css";

import { getStarterShellConfig } from "../../config/shell";

const mockUser = { email: "admin@starter-client.test", user_metadata: { first_name: "Starter", last_name: "Admin" } };

export default function CrmLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const { shellPreview: config } = getStarterShellConfig() as { shellPreview: ResolvedClientAppShellConfig };
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [crmExpanded, setCrmExpanded] = useState(true);
  const crmNavGroup = useMemo(() => getShellNavGroup(config, "crm") ?? ({ label: "CRM", icon: Users, children: [{ href: "/crm", label: "Contactos", icon: Users }] } satisfies NavGroupConfig), [config]);
  const isActive = (href: string) => href === pathname;
  const displayName = "Starter Admin";

  return (
    <AppShellFrame
      collapsed={isSidebarCollapsed}
      sidebar={<DesktopSidebar brand={config.brand} isSidebarCollapsed={isSidebarCollapsed} isToolActive={config.toolsSection.items.some((item) => isActive(item.href))} toolsExpanded={toolsExpanded} visiblePrimaryNav={config.primaryNav} adminNavItem={config.adminNavItem} visibleToolNav={config.toolsSection.items} crmNavGroup={crmNavGroup} crmGroupExpanded={crmExpanded} isCrmGroupActive={pathname.startsWith("/crm")} isNavItemActive={isActive} isToolLinkActive={isActive} isCrmChildActive={isActive} onToggleSidebar={() => setIsSidebarCollapsed((current) => {
        const next = !current;
        if (next) {
          setToolsExpanded(false);
          setCrmExpanded(false);
        }
        return next;
      })} onToggleTools={() => setToolsExpanded((current) => !current)} onToggleCrmGroup={() => setCrmExpanded((current) => !current)} account={{ displayName, isStaff: true, onSignOut: async () => {}, onThemeChange: () => {}, user: mockUser, userInitials: computeInitials(displayName) }} />}
      header={<AppHeader kicker="CRM" title={pathname === "/crm/report" ? "Relatório" : "Contactos"}>{pathname === "/crm" ? <CrmToolbarControls /> : null}</AppHeader>}
      mobileNav={<MobileNav toolsExpanded={toolsExpanded} visiblePrimaryNav={config.primaryNav} visibleToolNav={config.toolsSection.items} isNavItemActive={isActive} isToolLinkActive={isActive} onToggleTools={() => setToolsExpanded((current) => !current)} />}
    >
      {children}
    </AppShellFrame>
  );
}
