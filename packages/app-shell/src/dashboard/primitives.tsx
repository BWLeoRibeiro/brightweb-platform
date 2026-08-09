import type { ReactNode } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "../lib/utils";

export const dashboardCardTitleClassName = "text-title text-foreground";
export const dashboardLabelClassName = "text-label text-muted-foreground";
export const dashboardMonoTabularClassName = "text-data";

const dashboardActionClassName = "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--foreground-accent-link)]/40 bg-[color:var(--surface-button-brand)]/10 px-3.5 py-1.5 font-[inherit] text-meta font-semibold text-[color:var(--foreground-accent-link)] transition hover:border-[color:var(--surface-button-brand)] hover:bg-[color:var(--surface-button-brand)] hover:text-[color:var(--accent-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current [&_svg]:h-3.5 [&_svg]:w-3.5";
const quickCreateActionClassName = "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[color:var(--surface-button-brand)] px-3.5 py-1.5 text-meta font-semibold text-[color:var(--accent-foreground)] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current [&_svg]:h-3.5 [&_svg]:w-3.5";

const dashboardCountPillToneClassName = {
  neutral: "border-[color:var(--border)] bg-[color:var(--muted)] text-[color:var(--muted-foreground)]",
  accent: "border-[color:var(--accent)]/30 bg-[color:var(--accent)]/10 text-[color:var(--accent)]",
  warning: "border-[color:var(--project-risk-at-risk)]/30 bg-[color:var(--semantic-warning-soft,var(--muted))] text-[color:var(--semantic-warning-strong,var(--foreground))]",
} as const;

type DashboardCountPillProps = {
  count: ReactNode;
  label?: ReactNode;
  tone?: keyof typeof dashboardCountPillToneClassName;
};

type DashboardEmptyStateProps = {
  icon: ReactNode;
  title: ReactNode;
  description: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function DashboardActionLink({ href, children, className, prefetch }: { href: string; children: ReactNode; className?: string; prefetch?: boolean }) {
  return <Link href={href} prefetch={prefetch} className={cn(dashboardActionClassName, className)}>{children}</Link>;
}

export function QuickCreateAction({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} prefetch={false} className={quickCreateActionClassName}>
      <Plus aria-hidden />
      {label}
    </Link>
  );
}

export function DashboardCountPill({ count, label, tone = "neutral" }: DashboardCountPillProps) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-label font-bold", dashboardCountPillToneClassName[tone])}>
      <span className={dashboardMonoTabularClassName}>{count}</span>
      {label ? <>{" "}{label}</> : null}
    </span>
  );
}

export function DashboardEmptyState({ icon, title, description, children, className }: DashboardEmptyStateProps) {
  return (
    <div className={cn("flex h-full flex-col items-center justify-center gap-3 px-6 py-10 text-center", className)}>
      {icon}
      <div>
        <p className="text-body font-semibold text-[color:var(--foreground)]">{title}</p>
        <p className="mt-0.5 text-meta text-[color:var(--muted-foreground)]">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function DashboardSectionHeading({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-heading-2 text-foreground">{title}</h2>{subtitle ? <p className="mt-1 text-body text-[color:var(--muted-foreground)]">{subtitle}</p> : null}</div>{action}</div>;
}
