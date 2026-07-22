import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, Wrench } from "lucide-react";
import { cn } from "../lib/utils";
import { SidebarNavLink, SidebarSectionToggle, SidebarSubNavLink } from "./nav-primitives";
import type { DesktopSidebarProps } from "../types";
import { AccountMenu } from "./account-menu";
import styles from "./shell-surfaces.module.css";

export function DesktopSidebar({
  className,
  brand,
  account,
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
    <aside className={cn(styles.sidebarRoot, styles.desktopSidebarFrame, isSidebarCollapsed && styles.desktopSidebarCollapsed, className)}>
      <button
        type="button"
        onClick={onToggleSidebar}
        className={styles.sidebarToggle}
        aria-label={isSidebarCollapsed ? "Expandir menu lateral" : "Colapsar menu lateral"}
        title={isSidebarCollapsed ? "Expandir" : "Colapsar"}
      >
        <ChevronLeft />
      </button>

      <div className={styles.sidebarTop}>
        <Link
          href={brand.href}
          prefetch={false}
          className={styles.sidebarBrand}
          aria-label={brand.ariaLabel}
        >
          {isSidebarCollapsed ? (
            <Image
              src={brand.collapsedLogo.src}
              alt={brand.alt}
              width={brand.collapsedLogo.width}
              height={brand.collapsedLogo.height}
              className="h-9 w-auto max-w-full object-contain"
              priority
            />
          ) : (
            <>
              <Image
                src={brand.lightLogo.src}
                alt={brand.alt}
                width={brand.lightLogo.width}
                height={brand.lightLogo.height}
                className="h-9 w-auto max-w-full object-contain dark:hidden"
                priority
              />
              <Image
                src={brand.darkLogo.src}
                alt={brand.alt}
                width={brand.darkLogo.width}
                height={brand.darkLogo.height}
                className="hidden h-9 w-auto max-w-full object-contain dark:block"
                priority
              />
            </>
          )}
        </Link>
      </div>

      <nav className={styles.sidebarNav}>
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

        {crmNavGroup.children.length > 0 ? <span className={styles.navDivider} aria-hidden /> : null}

        {crmNavGroup.children.length > 0 ? (
          <div className={cn(styles.navGroup, !isSidebarCollapsed && crmGroupExpanded && styles.navGroupOpen, isCrmGroupActive && styles.navGroupHasActive)}>
            <SidebarSectionToggle
              controlsId="crm-nav-desktop"
              expanded={crmGroupExpanded}
              icon={crmNavGroup.icon}
              label={crmNavGroup.label}
              onToggle={() => {
                if (isSidebarCollapsed) onToggleSidebar();
                onToggleCrmGroup();
              }}
            />

            <div
              id="crm-nav-desktop"
              className={styles.navChildren}
            >
              <div className={styles.navChildrenInner}>
                <div className={styles.navChildList}>
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
          </div>
        ) : null}

        {visibleToolNav.length > 0 ? (
          <div className={cn(styles.navGroup, !isSidebarCollapsed && toolsExpanded && styles.navGroupOpen, isToolActive && styles.navGroupHasActive)}>
            <SidebarSectionToggle
              controlsId="tools-nav-desktop"
              expanded={toolsExpanded}
              icon={Wrench}
              label="Ferramentas"
              onToggle={() => {
                if (isSidebarCollapsed) onToggleSidebar();
                onToggleTools();
              }}
            />

            <div
              id="tools-nav-desktop"
              className={styles.navChildren}
            >
              <div className={styles.navChildrenInner}>
                <div className={styles.navChildList}>
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
          </div>
        ) : null}

        {adminNavItem ? (
          <>
            <span className={styles.navDivider} aria-hidden />
            <SidebarNavLink
              href={adminNavItem.href}
              icon={adminNavItem.icon}
              label={adminNavItem.label}
              collapsed={isSidebarCollapsed}
              active={isNavItemActive(adminNavItem.href)}
            />
          </>
        ) : null}
      </nav>
      {account ? (
        <div className={styles.sidebarAccount}>
          <AccountMenu {...account} variant="rail" collapsed={isSidebarCollapsed} />
        </div>
      ) : null}
    </aside>
  );
}
