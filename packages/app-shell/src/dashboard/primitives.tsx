import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "../lib/utils";

export const dashboardCardTitleClassName = "portal-card-title";
export const dashboardLabelClassName = "portal-label";
export const dashboardMonoTabularClassName = "font-mono tabular-nums";

const dashboardActionClassName = "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 px-3.5 py-1.5 font-[inherit] text-[12px] font-semibold text-[color:var(--accent)] transition hover:border-[color:var(--accent)] hover:bg-[color:var(--accent)] hover:text-[color:var(--accent-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] [&_svg]:h-3.5 [&_svg]:w-3.5";

export function DashboardActionLink({ href, children, className, prefetch }: { href: string; children: ReactNode; className?: string; prefetch?: boolean }) {
  return <Link href={href} prefetch={prefetch} className={cn(dashboardActionClassName, className)}>{children}</Link>;
}

export function DashboardSectionHeading({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="portal-heading">{title}</h2>{subtitle ? <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{subtitle}</p> : null}</div>{action}</div>;
}
