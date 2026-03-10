import Link from "next/link";
import { ChevronDown, Wrench } from "lucide-react";
import { cn } from "../lib/utils";
import type { MobileNavProps } from "../types";

export function MobileNav({
  className,
  toolsExpanded,
  visiblePrimaryNav,
  visibleToolNav,
  isNavItemActive,
  isToolLinkActive,
  onToggleTools,
}: MobileNavProps) {
  return (
    <nav className={className}>
      <div className="flex flex-wrap gap-2">
        {visiblePrimaryNav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              isNavItemActive(href)
                ? "border-primary/35 bg-primary/10 text-foreground"
                : "border-black/10 text-foreground/75 hover:border-black/20 hover:text-foreground dark:border-white/10 dark:hover:border-white/25",
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </Link>
        ))}

        <button
          onClick={onToggleTools}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            toolsExpanded
              ? "border-primary/35 bg-primary/10 text-foreground"
              : "border-black/10 text-foreground/75 hover:border-black/20 hover:text-foreground dark:border-white/10 dark:hover:border-white/25",
          )}
          aria-expanded={toolsExpanded}
          aria-controls="tools-nav-mobile"
        >
          <Wrench className="size-3.5" />
          Ferramentas
          <ChevronDown className={cn("size-3.5 opacity-70 transition-transform", toolsExpanded && "rotate-180")} />
        </button>

        <div
          id="tools-nav-mobile"
          className={cn(
            "basis-full overflow-hidden pl-1 transition-all duration-300",
            toolsExpanded ? "max-h-32 opacity-100" : "max-h-0 opacity-0",
          )}
        >
          <div className="mt-2 flex flex-wrap gap-2">
            {visibleToolNav.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  isToolLinkActive(href)
                    ? "border-primary/35 bg-primary/10 text-foreground"
                    : "border-black/10 text-foreground/75 hover:border-black/20 hover:text-foreground dark:border-white/10 dark:hover:border-white/25",
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
