"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BriefcaseBusiness } from "lucide-react";
import { AppHeader, AppShellFrame, DesktopSidebar, MobileNav, computeInitials, getShellNavGroup, type NavGroupConfig, type ShellContextualAction } from "@brightweblabs/app-shell";
import { defaultProjectsUiDictionary, ProjectsToolbarControls } from "@brightweblabs/module-projects/ui";
import "@brightweblabs/module-projects/tokens.css";
import { getStarterShellConfig } from "../../config/shell";
import { previewNotifications } from "../../config/notifications";
import { projects } from "./mock-data";

const mockUser = { email: "admin@starter-client.test", user_metadata: { first_name: "Starter", last_name: "Admin" } };

export default function ProjectsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const { shellPreview: config, toolbarRoutes, toolbarActions } = getStarterShellConfig();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [crmExpanded, setCrmExpanded] = useState(false);
  const crmNavGroup = useMemo(() => getShellNavGroup(config, "crm") ?? ({ label: "CRM", icon: BriefcaseBusiness, children: [] } satisfies NavGroupConfig), [config]);
  const isActive = (href: string) => href === pathname;
  const displayName = "Starter Admin";
  const projectId = pathname.split("/")[2];
  const isBoard = pathname.endsWith("/board") || pathname.endsWith("/tasks");
  const header = defaultProjectsUiDictionary.header;
  const handleToolbarAction = (item: ShellContextualAction) => {
    if (item.action === "projects-back-to-portfolio") router.push("/projects");
    if (item.action === "projects-open-board" && projectId) router.push(`/projects/${projectId}/tasks`);
  };
  return <AppShellFrame
    collapsed={isSidebarCollapsed}
    sidebar={<DesktopSidebar brand={config.brand} isSidebarCollapsed={isSidebarCollapsed} isToolActive={config.toolsSection.items.some((item) => isActive(item.href))} toolsExpanded={toolsExpanded} visiblePrimaryNav={config.primaryNav} adminNavItem={config.adminNavItem} visibleToolNav={config.toolsSection.items} crmNavGroup={crmNavGroup} crmGroupExpanded={crmExpanded} isCrmGroupActive={pathname.startsWith("/crm")} isNavItemActive={isActive} isToolLinkActive={isActive} isCrmChildActive={isActive} onToggleSidebar={() => setIsSidebarCollapsed((value) => !value)} onToggleTools={() => setToolsExpanded((value) => !value)} onToggleCrmGroup={() => setCrmExpanded((value) => !value)} account={{ displayName, isStaff: true, onSignOut: async () => {}, onThemeChange: () => {}, user: mockUser, userInitials: computeInitials(displayName) }} />}
    header={<AppHeader kicker={projectId ? header.projectKicker : header.portfolioKicker} title={isBoard ? header.tasksTitle : projectId ? header.detailTitle : header.portfolioTitle} count={pathname === "/projects" ? projects.length : undefined} pathname={pathname} toolbarRoutes={toolbarRoutes} toolbarActions={toolbarActions} onToolbarAction={handleToolbarAction} notifications={{ notifications: previewNotifications, unreadCount: previewNotifications.length }}>{pathname === "/projects" ? <ProjectsToolbarControls /> : null}</AppHeader>}
    mobileNav={<MobileNav toolsExpanded={toolsExpanded} visiblePrimaryNav={config.primaryNav} visibleToolNav={config.toolsSection.items} isNavItemActive={isActive} isToolLinkActive={isActive} onToggleTools={() => setToolsExpanded((value) => !value)} />}
  >{children}</AppShellFrame>;
}
