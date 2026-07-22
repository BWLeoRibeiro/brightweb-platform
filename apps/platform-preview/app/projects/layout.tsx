"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { BriefcaseBusiness } from "lucide-react";
import { AppHeader, AppShellFrame, DesktopSidebar, MobileNav, computeInitials, getShellNavGroup, type NavGroupConfig, type ResolvedClientAppShellConfig } from "@brightweblabs/app-shell";
import { ProjectsToolbarControls } from "@brightweblabs/module-projects/ui";
import "@brightweblabs/module-projects/tokens.css";
import { getStarterShellConfig } from "../../config/shell";

const mockUser = { email: "admin@starter-client.test", user_metadata: { first_name: "Starter", last_name: "Admin" } };

export default function ProjectsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const { shellPreview: config } = getStarterShellConfig() as { shellPreview: ResolvedClientAppShellConfig };
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [crmExpanded, setCrmExpanded] = useState(false);
  const crmNavGroup = useMemo(() => getShellNavGroup(config, "crm") ?? ({ label: "CRM", icon: BriefcaseBusiness, children: [] } satisfies NavGroupConfig), [config]);
  const isActive = (href: string) => href === pathname;
  const displayName = "Starter Admin";
  const projectId = pathname.split("/")[2];
  return <AppShellFrame
    collapsed={isSidebarCollapsed}
    sidebar={<DesktopSidebar brand={config.brand} isSidebarCollapsed={isSidebarCollapsed} isToolActive={config.toolsSection.items.some((item) => isActive(item.href))} toolsExpanded={toolsExpanded} visiblePrimaryNav={config.primaryNav} adminNavItem={config.adminNavItem} visibleToolNav={config.toolsSection.items} crmNavGroup={crmNavGroup} crmGroupExpanded={crmExpanded} isCrmGroupActive={pathname.startsWith("/crm")} isNavItemActive={isActive} isToolLinkActive={isActive} isCrmChildActive={isActive} onToggleSidebar={() => setIsSidebarCollapsed((value) => !value)} onToggleTools={() => setToolsExpanded((value) => !value)} onToggleCrmGroup={() => setCrmExpanded((value) => !value)} account={{ displayName, isStaff: true, onSignOut: async () => {}, onThemeChange: () => {}, user: mockUser, userInitials: computeInitials(displayName) }} />}
    header={<AppHeader kicker="Projetos" title={projectId ? "Visão geral" : "Portfólio"}>{pathname === "/projects" ? <ProjectsToolbarControls /> : null}</AppHeader>}
    mobileNav={<MobileNav toolsExpanded={toolsExpanded} visiblePrimaryNav={config.primaryNav} visibleToolNav={config.toolsSection.items} isNavItemActive={isActive} isToolLinkActive={isActive} onToggleTools={() => setToolsExpanded((value) => !value)} />}
  >{children}</AppShellFrame>;
}
