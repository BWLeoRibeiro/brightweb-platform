"use client";

import { useMemo, useState } from "react";
import {
  AccountMenu,
  AppHeader,
  DesktopSidebar,
  MobileNav,
  computeInitials,
  getShellNavGroup,
  type NavGroupConfig,
  type ResolvedClientAppShellConfig,
} from "@brightweblabs/app-shell";
import { LayoutTemplate, Sparkles, Users } from "lucide-react";
import { starterBrandConfig } from "../../config/brand";
import { getStarterShellConfig } from "../../config/shell";

const mockUser = {
  email: "admin@starter-client.test",
  user_metadata: {
    first_name: "Starter",
    last_name: "Admin",
  },
};

const mockSurfaceCards = [
  {
    title: "Module activation",
    description: "Nav, admin access, and tools placement are resolved from the starter client config.",
    icon: LayoutTemplate,
  },
  {
    title: "Shared updates",
    description: "The shell primitives come from `@brightweblabs/app-shell`, so new clients keep the same integration contract.",
    icon: Sparkles,
  },
  {
    title: "User governance",
    description: "Admin placement stays visible because the preview assumes an admin/staff viewer.",
    icon: Users,
  },
];

export function AppShellPreview() {
  const { shellPreview: config } = getStarterShellConfig() as { shellPreview: ResolvedClientAppShellConfig };
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(true);
  const [crmExpanded, setCrmExpanded] = useState(true);
  const [activeHref, setActiveHref] = useState(config.primaryNav[0]?.href ?? "/dashboard");

  const crmNavGroup = useMemo(
    () =>
      getShellNavGroup(config, "crm")
      ?? ({
        label: "CRM",
        icon: Users,
        children: [{ href: "/crm", label: "CRM", icon: Users }],
      } satisfies NavGroupConfig),
    [config],
  );
  const collapsedToolsHref = config.toolsSection.items[0]?.href ?? "/";
  const displayName = "Starter Admin";
  const userInitials = computeInitials(displayName);
  const isNavItemActive = (href: string) => activeHref === href;
  const isToolLinkActive = (href: string) => activeHref === href;
  const isCrmChildActive = (href: string) => activeHref === href;
  const isCrmGroupActive = crmNavGroup.children.some((item) => activeHref === item.href);
  const isToolActive = config.toolsSection.items.some((item) => activeHref === item.href);

  return (
    <div className="app-preview-shell">
      <DesktopSidebar
        className="app-preview-sidebar"
        brand={config.brand}
        collapsedToolsHref={collapsedToolsHref}
        isSidebarCollapsed={isSidebarCollapsed}
        isToolActive={isToolActive}
        toolsExpanded={toolsExpanded}
        visiblePrimaryNav={config.primaryNav}
        adminNavItem={config.adminNavItem}
        visibleToolNav={config.toolsSection.items}
        crmNavGroup={crmNavGroup}
        crmGroupExpanded={crmExpanded}
        isCrmGroupActive={isCrmGroupActive}
        isNavItemActive={isNavItemActive}
        isToolLinkActive={isToolLinkActive}
        isCrmChildActive={isCrmChildActive}
        onToggleSidebar={() => setIsSidebarCollapsed((current) => !current)}
        onToggleTools={() => setToolsExpanded((current) => !current)}
        onToggleCrmGroup={() => setCrmExpanded((current) => !current)}
      />

      <div className="app-preview-main">
        <AppHeader className="app-preview-header">
          <div className="app-preview-header-copy">
            <span className="eyebrow">{starterBrandConfig.companyName}</span>
            <h1>Logged-in shell preview</h1>
            <p className="muted">This is the packaged shell running with the starter client registration.</p>
          </div>
          <div className="app-preview-header-actions">
            <div className="status ok">Admin preview</div>
            <AccountMenu
              displayName={displayName}
              isStaff
              onSignOut={async () => {}}
              user={mockUser}
              userInitials={userInitials}
            />
          </div>
        </AppHeader>

        <div className="app-preview-mobile-nav">
          <MobileNav
            className="panel"
            toolsExpanded={toolsExpanded}
            visiblePrimaryNav={config.primaryNav}
            visibleToolNav={config.toolsSection.items}
            isNavItemActive={isNavItemActive}
            isToolLinkActive={isToolLinkActive}
            onToggleTools={() => setToolsExpanded((current) => !current)}
          />
        </div>

        <section className="app-preview-content">
          <div className="app-preview-stage">
            <div className="grid">
              {mockSurfaceCards.map((card) => (
                <article key={card.title} className="panel preview-glass-card">
                  <div className="panel-inner">
                    <div className="preview-card-icon">
                      <card.icon className="size-4" />
                    </div>
                    <h2>{card.title}</h2>
                    <p className="muted">{card.description}</p>
                  </div>
                </article>
              ))}
            </div>

            <article className="panel preview-stage-panel">
              <div className="panel-inner">
                <div className="preview-stage-head">
                  <div>
                    <span className="eyebrow">Active path</span>
                    <h2>{activeHref}</h2>
                  </div>
                  <div className="actions">
                    {[...config.primaryNav, ...crmNavGroup.children, ...(config.adminNavItem ? [config.adminNavItem] : []), ...config.toolsSection.items].map((item) => (
                      <button
                        key={item.href}
                        type="button"
                        className={`nav-chip ${activeHref === item.href ? "active" : ""}`}
                        onClick={() => setActiveHref(item.href)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="preview-surface-grid">
                  <div className="preview-surface-card">
                    <p className="preview-label">Primary navigation</p>
                    <strong>{config.primaryNav.length} item(s)</strong>
                    <span>{config.primaryNav.map((item) => item.label).join(" · ")}</span>
                  </div>
                  <div className="preview-surface-card">
                    <p className="preview-label">CRM group</p>
                    <strong>{crmNavGroup.children.length} item(s)</strong>
                    <span>{crmNavGroup.children.map((item) => item.label).join(" · ")}</span>
                  </div>
                  <div className="preview-surface-card">
                    <p className="preview-label">Tools section</p>
                    <strong>{config.toolsSection.items.length} item(s)</strong>
                    <span>{config.toolsSection.items.map((item) => item.label).join(" · ") || "No tools enabled"}</span>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>
      </div>
    </div>
  );
}
