import Link from "next/link";
import { ChevronDown, Wrench, type LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";

type SidebarNavLinkProps = {
  active: boolean;
  collapsed?: boolean;
  href: string;
  icon: LucideIcon;
  label: string;
  title?: string;
};

type SidebarSectionToggleProps = {
  controlsId: string;
  expanded: boolean;
  icon: LucideIcon;
  label: string;
  onToggle: () => void;
};

type SidebarSubNavLinkProps = {
  active: boolean;
  href: string;
  icon: LucideIcon;
  label: string;
};

type MobileNavPillProps = {
  active: boolean;
  href: string;
  icon: LucideIcon;
  label: string;
};

type MobileTogglePillProps = {
  controlsId: string;
  expanded: boolean;
  onToggle: () => void;
};

function getSidebarItemClasses(active: boolean) {
  return active
    ? "border-primary/35 bg-primary/10 text-foreground"
    : "border-transparent bg-transparent text-foreground/70 hover:border-black/10 hover:bg-black/5 hover:text-foreground dark:hover:border-white/10 dark:hover:bg-white/5";
}

function getSidebarIconClasses(active: boolean) {
  return active
    ? "bg-primary/18 text-primary"
    : "bg-black/5 text-foreground/65 group-hover:text-primary dark:bg-white/5";
}

function getMobilePillClasses(active: boolean) {
  return active
    ? "border-primary/35 bg-primary/10 text-foreground"
    : "border-black/10 text-foreground/75 hover:border-black/20 hover:text-foreground dark:border-white/10 dark:hover:border-white/25";
}

export function SidebarNavLink({
  active,
  collapsed = false,
  href,
  icon: Icon,
  label,
  title,
}: SidebarNavLinkProps) {
  return (
    <Link
      href={href}
      title={collapsed ? title ?? label : undefined}
      className={cn(
        "group relative flex items-center rounded-2xl border py-3 text-sm font-medium transition-all",
        collapsed ? "justify-center px-2" : "gap-3 px-4",
        getSidebarItemClasses(active),
      )}
    >
      <span
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-xl transition-colors",
          getSidebarIconClasses(active),
        )}
      >
        <Icon className="size-4" />
      </span>
      {!collapsed ? label : null}
    </Link>
  );
}

export function SidebarSectionToggle({
  controlsId,
  expanded,
  icon: Icon,
  label,
  onToggle,
}: SidebarSectionToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-all",
        expanded
          ? "border-primary/35 bg-primary/10 text-foreground"
          : "border-transparent text-foreground/70 hover:border-black/10 hover:bg-black/5 hover:text-foreground dark:hover:border-white/10 dark:hover:bg-white/5",
      )}
      aria-expanded={expanded}
      aria-controls={controlsId}
    >
      <span
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-xl",
          expanded ? "bg-primary/18 text-primary" : "bg-black/5 text-foreground/65 dark:bg-white/5",
        )}
      >
        <Icon className="size-4" />
      </span>
      {label}
      <ChevronDown className={cn("ml-auto size-4 opacity-70 transition-transform", expanded && "rotate-180")} />
    </button>
  );
}

export function SidebarSubNavLink({ active, href, icon: Icon, label }: SidebarSubNavLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors",
        active
          ? "border-primary/35 bg-primary/10 text-foreground"
          : "border-transparent text-foreground/70 hover:border-black/10 hover:bg-black/5 hover:text-foreground dark:hover:border-white/10 dark:hover:bg-white/5",
      )}
    >
      <Icon className="size-4 text-primary" />
      {label}
    </Link>
  );
}

export function MobileNavPill({ active, href, icon: Icon, label }: MobileNavPillProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        getMobilePillClasses(active),
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </Link>
  );
}

export function MobileTogglePill({ controlsId, expanded, onToggle }: MobileTogglePillProps) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        getMobilePillClasses(expanded),
      )}
      aria-expanded={expanded}
      aria-controls={controlsId}
    >
      <Wrench className="size-3.5" />
      Ferramentas
      <ChevronDown className={cn("size-3.5 opacity-70 transition-transform", expanded && "rotate-180")} />
    </button>
  );
}
