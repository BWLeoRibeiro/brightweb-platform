import Image from "next/image";
import Link from "next/link";
import { ChevronDown, PanelLeftClose, PanelLeftOpen, Wrench } from "lucide-react";
import { cn } from "../lib/utils";
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
          <Link
            key={href}
            href={href}
            className={cn(
              "group relative flex items-center rounded-2xl border py-3 text-sm font-medium transition-all",
              isSidebarCollapsed ? "justify-center px-2" : "gap-3 px-4",
              isNavItemActive(href)
                ? "border-primary/35 bg-primary/10 text-foreground"
                : "border-transparent bg-transparent text-foreground/70 hover:border-black/10 hover:bg-black/5 hover:text-foreground dark:hover:border-white/10 dark:hover:bg-white/5",
            )}
          >
            <span
              className={cn(
                "inline-flex size-8 items-center justify-center rounded-xl transition-colors",
                isNavItemActive(href)
                  ? "bg-primary/18 text-primary"
                  : "bg-black/5 text-foreground/65 group-hover:text-primary dark:bg-white/5",
              )}
            >
              <Icon className="size-4" />
            </span>
            {!isSidebarCollapsed ? label : null}
          </Link>
        ))}

        {isSidebarCollapsed ? (
          <Link
            href={crmNavGroup.children[0]?.href ?? "/crm"}
            className={cn(
              "group relative flex items-center justify-center rounded-2xl border px-2 py-3 text-sm font-medium transition-all",
              isCrmGroupActive
                ? "border-primary/35 bg-primary/10 text-foreground"
                : "border-transparent bg-transparent text-foreground/70 hover:border-black/10 hover:bg-black/5 hover:text-foreground dark:hover:border-white/10 dark:hover:bg-white/5",
            )}
            title={crmNavGroup.label}
          >
            <span
              className={cn(
                "inline-flex size-8 items-center justify-center rounded-xl transition-colors",
                isCrmGroupActive ? "bg-primary/18 text-primary" : "bg-black/5 text-foreground/65 dark:bg-white/5",
              )}
            >
              <crmNavGroup.icon className="size-4" />
            </span>
          </Link>
        ) : (
          <div className="space-y-1">
            <button
              onClick={onToggleCrmGroup}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-all",
                crmGroupExpanded
                  ? "border-primary/35 bg-primary/10 text-foreground"
                  : "border-transparent text-foreground/70 hover:border-black/10 hover:bg-black/5 hover:text-foreground dark:hover:border-white/10 dark:hover:bg-white/5",
              )}
              aria-expanded={crmGroupExpanded}
              aria-controls="crm-nav-desktop"
            >
              <span
                className={cn(
                  "inline-flex size-8 items-center justify-center rounded-xl",
                  crmGroupExpanded ? "bg-primary/18 text-primary" : "bg-black/5 text-foreground/65 dark:bg-white/5",
                )}
              >
                <crmNavGroup.icon className="size-4" />
              </span>
              {crmNavGroup.label}
              <ChevronDown className={cn("ml-auto size-4 opacity-70 transition-transform", crmGroupExpanded && "rotate-180")} />
            </button>

            <div
              id="crm-nav-desktop"
              className={cn("overflow-hidden transition-all duration-300", crmGroupExpanded ? "max-h-40 opacity-100" : "max-h-0 opacity-0")}
            >
              <div className="space-y-1 pl-4">
                {crmNavGroup.children.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors",
                      isCrmChildActive(href)
                        ? "border-primary/35 bg-primary/10 text-foreground"
                        : "border-transparent text-foreground/70 hover:border-black/10 hover:bg-black/5 hover:text-foreground dark:hover:border-white/10 dark:hover:bg-white/5",
                    )}
                  >
                    <Icon className="size-4 text-primary" />
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {adminNavItem ? (
          <Link
            href={adminNavItem.href}
            className={cn(
              "group relative flex items-center rounded-2xl border py-3 text-sm font-medium transition-all",
              isSidebarCollapsed ? "justify-center px-2" : "gap-3 px-4",
              isNavItemActive(adminNavItem.href)
                ? "border-primary/35 bg-primary/10 text-foreground"
                : "border-transparent bg-transparent text-foreground/70 hover:border-black/10 hover:bg-black/5 hover:text-foreground dark:hover:border-white/10 dark:hover:bg-white/5",
            )}
          >
            <span
              className={cn(
                "inline-flex size-8 items-center justify-center rounded-xl transition-colors",
                isNavItemActive(adminNavItem.href)
                  ? "bg-primary/18 text-primary"
                  : "bg-black/5 text-foreground/65 group-hover:text-primary dark:bg-white/5",
              )}
            >
              <adminNavItem.icon className="size-4" />
            </span>
            {!isSidebarCollapsed ? adminNavItem.label : null}
          </Link>
        ) : null}

        {isSidebarCollapsed ? (
          <Link
            href={collapsedToolsHref}
            className={cn(
              "group relative flex items-center justify-center rounded-2xl border px-2 py-3 text-sm font-medium transition-all",
              isToolActive
                ? "border-primary/35 bg-primary/10 text-foreground"
                : "border-transparent bg-transparent text-foreground/70 hover:border-black/10 hover:bg-black/5 hover:text-foreground dark:hover:border-white/10 dark:hover:bg-white/5",
            )}
            title="Ferramentas"
          >
            <span
              className={cn(
                "inline-flex size-8 items-center justify-center rounded-xl transition-colors",
                isToolActive ? "bg-primary/18 text-primary" : "bg-black/5 text-foreground/65 dark:bg-white/5",
              )}
            >
              <Wrench className="size-4" />
            </span>
          </Link>
        ) : (
          <div className="space-y-1">
            <button
              onClick={onToggleTools}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-all",
                toolsExpanded
                  ? "border-primary/35 bg-primary/10 text-foreground"
                  : "border-transparent text-foreground/70 hover:border-black/10 hover:bg-black/5 hover:text-foreground dark:hover:border-white/10 dark:hover:bg-white/5",
              )}
              aria-expanded={toolsExpanded}
              aria-controls="tools-nav-desktop"
            >
              <span
                className={cn(
                  "inline-flex size-8 items-center justify-center rounded-xl",
                  toolsExpanded ? "bg-primary/18 text-primary" : "bg-black/5 text-foreground/65 dark:bg-white/5",
                )}
              >
                <Wrench className="size-4" />
              </span>
              Ferramentas
              <ChevronDown className={cn("ml-auto size-4 opacity-70 transition-transform", toolsExpanded && "rotate-180")} />
            </button>

            <div
              id="tools-nav-desktop"
              className={cn("overflow-hidden transition-all duration-300", toolsExpanded ? "max-h-40 opacity-100" : "max-h-0 opacity-0")}
            >
              <div className="space-y-1 pl-4">
                {visibleToolNav.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors",
                      isToolLinkActive(href)
                        ? "border-primary/35 bg-primary/10 text-foreground"
                        : "border-transparent text-foreground/70 hover:border-black/10 hover:bg-black/5 hover:text-foreground dark:hover:border-white/10 dark:hover:bg-white/5",
                    )}
                  >
                    <Icon className="size-4 text-primary" />
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </nav>
    </aside>
  );
}
