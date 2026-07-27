import { cn } from "../lib/utils";
import { MobileNavPill, MobileTogglePill } from "./nav-primitives";
import type { MobileNavProps } from "../types";

export function MobileNav({
  className,
  toolsExpanded,
  visiblePrimaryNav,
  visibleToolNav,
  navGroups,
  isNavItemActive,
  isToolLinkActive,
  onToggleTools,
}: MobileNavProps) {
  return (
    <nav className={className}>
      <div className="flex flex-wrap gap-2">
        {visiblePrimaryNav.map(({ href, label, icon: Icon }) => (
          <MobileNavPill
            key={href}
            href={href}
            icon={Icon}
            label={label}
            active={isNavItemActive(href)}
          />
        ))}

        {navGroups.map((navGroup) => (
          <div key={navGroup.key} className="basis-full">
            <p className="mb-2 mt-3 px-1 text-xs font-semibold text-foreground/60">
              {navGroup.label}
            </p>
            <div className="flex flex-wrap gap-2">
              {navGroup.children.map(({ href, label, icon: Icon }) => (
                <MobileNavPill
                  key={href}
                  href={href}
                  icon={Icon}
                  label={label}
                  active={isNavItemActive(href)}
                />
              ))}
            </div>
          </div>
        ))}

        <MobileTogglePill controlsId="tools-nav-mobile" expanded={toolsExpanded} onToggle={onToggleTools} />

        <div
          id="tools-nav-mobile"
          className={cn(
            "basis-full overflow-hidden pl-1 transition-all duration-300",
            toolsExpanded ? "max-h-32 opacity-100" : "max-h-0 opacity-0",
          )}
        >
          <div className="mt-2 flex flex-wrap gap-2">
            {visibleToolNav.map(({ href, label, icon: Icon }) => (
              <MobileNavPill
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
    </nav>
  );
}
