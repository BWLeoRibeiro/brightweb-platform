import Image from "next/image";
import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen, Wrench } from "lucide-react";
import { cn } from "../lib/utils";
import { SidebarNavLink, SidebarSectionToggle, SidebarSubNavLink } from "./nav-primitives";
import type { DesktopSidebarProps } from "../types";

export function DesktopSidebar({
  className,
  brand,
  collapsedToolsHref,
  isSidebarCollapsed,
  isToolActive,
  toolsExpanded,
  visiblePrimaryNav,
  adminNavItem,
  visibleToolNav,
  crmNavGroup,
  crmGroupExpanded,
  isCrmGroupActive,
  isNavItemActive,
  isToolLinkActive,
  isCrmChildActive,
  onToggleSidebar,
  onToggleTools,
  onToggleCrmGroup,
}: DesktopSidebarProps) {
  return (
    <aside className={className}>
      <button
        onClick={onToggleSidebar}
        className="absolute -right-4 top-4 z-30 inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/15 bg-background text-foreground/80 shadow-sm transition-colors hover:border-black/25 hover:text-foreground dark:border-white/20 dark:hover:border-white/35"
        aria-label={isSidebarCollapsed ? "Expandir menu lateral" : "Colapsar menu lateral"}
      >
        {isSidebarCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
      </button>

      <div className={cn("pb-7 pt-9", isSidebarCollapsed ? "px-2" : "px-7")}>
        <Link
          href={brand.href}
          className={cn("mb-4", isSidebarCollapsed ? "flex w-full justify-center" : "inline-flex")}
          aria-label={brand.ariaLabel}
        >
          {isSidebarCollapsed ? (
            <Image
              src={brand.collapsedLogo.src}
              alt={brand.alt}
              width={brand.collapsedLogo.width}
              height={brand.collapsedLogo.height}
              className="h-12 w-auto max-w-full object-contain"
              priority
            />
          ) : (
            <>
              <Image
                src={brand.lightLogo.src}
                alt={brand.alt}
                width={brand.lightLogo.width}
                height={brand.lightLogo.height}
                className="h-8 w-auto object-contain dark:hidden"
                priority
              />
              <Image
                src={brand.darkLogo.src}
                alt={brand.alt}
                width={brand.darkLogo.width}
                height={brand.darkLogo.height}
                className="hidden h-8 w-auto object-contain dark:block"
                priority
              />
            </>
          )}
        </Link>
      </div>

      <nav className={cn("min-h-0 flex-1 space-y-1.5 overflow-y-auto", isSidebarCollapsed ? "px-1.5" : "px-4")}>
        {visiblePrimaryNav.map(({ href, label, icon: Icon }) => (
          <SidebarNavLink
            key={href}
            href={href}
            icon={Icon}
            label={label}
            collapsed={isSidebarCollapsed}
            active={isNavItemActive(href)}
          />
        ))}

        {isSidebarCollapsed ? (
          <SidebarNavLink
            href={crmNavGroup.children[0]?.href ?? "/crm"}
            icon={crmNavGroup.icon}
            label={crmNavGroup.label}
            title={crmNavGroup.label}
            collapsed
            active={isCrmGroupActive}
          />
        ) : (
          <div className="space-y-1">
            <SidebarSectionToggle
              controlsId="crm-nav-desktop"
              expanded={crmGroupExpanded}
              icon={crmNavGroup.icon}
              label={crmNavGroup.label}
              onToggle={onToggleCrmGroup}
            />

            <div
              id="crm-nav-desktop"
              className={cn("overflow-hidden transition-all duration-300", crmGroupExpanded ? "max-h-40 opacity-100" : "max-h-0 opacity-0")}
            >
              <div className="space-y-1 pl-4">
                {crmNavGroup.children.map(({ href, label, icon: Icon }) => (
                  <SidebarSubNavLink
                    key={href}
                    href={href}
                    icon={Icon}
                    label={label}
                    active={isCrmChildActive(href)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {adminNavItem ? (
          <SidebarNavLink
            href={adminNavItem.href}
            icon={adminNavItem.icon}
            label={adminNavItem.label}
            collapsed={isSidebarCollapsed}
            active={isNavItemActive(adminNavItem.href)}
          />
        ) : null}

        {isSidebarCollapsed ? (
          <SidebarNavLink
            href={collapsedToolsHref}
            icon={Wrench}
            label="Ferramentas"
            title="Ferramentas"
            collapsed
            active={isToolActive}
          />
        ) : (
          <div className="space-y-1">
            <SidebarSectionToggle
              controlsId="tools-nav-desktop"
              expanded={toolsExpanded}
              icon={Wrench}
              label="Ferramentas"
              onToggle={onToggleTools}
            />

            <div
              id="tools-nav-desktop"
              className={cn("overflow-hidden transition-all duration-300", toolsExpanded ? "max-h-40 opacity-100" : "max-h-0 opacity-0")}
            >
              <div className="space-y-1 pl-4">
                {visibleToolNav.map(({ href, label, icon: Icon }) => (
                  <SidebarSubNavLink
                    key={href}
                    href={href}
                    icon={Icon}
                    label={label}
                    active={isToolLinkActive(href)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </nav>
    </aside>
  );
}
