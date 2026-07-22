import Link from "next/link";
import { ChevronDown, Wrench, type LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";
import styles from "./shell-surfaces.module.css";

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

function getMobilePillClasses(active: boolean) {
  return active
    ? "border-primary/35 bg-primary/10 text-foreground"
    : "border-hairline text-foreground/75 hover:border-border-strong hover:bg-surface-hover hover:text-foreground";
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
      prefetch={false}
      title={collapsed ? title ?? label : undefined}
      className={cn(
        styles.navItem,
        active && styles.navItemActive,
      )}
    >
      <span
        className={styles.navIcon}
      >
        <Icon className="size-4" />
      </span>
      {!collapsed ? <span className={styles.navLabel}>{label}</span> : null}
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
      type="button"
      onClick={onToggle}
      className={styles.navItem}
      aria-expanded={expanded}
      aria-controls={controlsId}
    >
      <span className={styles.navIcon}>
        <Icon className="size-4" />
      </span>
      <span className={styles.navLabel}>{label}</span>
      <ChevronDown className={styles.navCaret} />
    </button>
  );
}

export function SidebarSubNavLink({ active, href, icon: Icon, label }: SidebarSubNavLinkProps) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={cn(styles.navChild, active && styles.navChildActive)}
    >
      <Icon className="size-4" />
      <span className={styles.navLabel}>{label}</span>
    </Link>
  );
}

export function MobileNavPill({ active, href, icon: Icon, label }: MobileNavPillProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
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
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
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
