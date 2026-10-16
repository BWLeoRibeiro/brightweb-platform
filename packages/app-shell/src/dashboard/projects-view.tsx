"use client";

import Link from "next/link";
import { ArrowUpRight, CheckCircle2, CircleDot, Flag } from "lucide-react";
import { Card, Skeleton } from "@brightweblabs/ui";
import type { DashboardProjectMilestone, DashboardProjectsData } from "./types";
import { DashboardActionLink as PortalActionLink, DashboardCountPill, DashboardEmptyState, DashboardSectionHeading as PortalSectionHeading, QuickCreateAction, dashboardCardTitleClassName as CARD_TITLE, dashboardMonoTabularClassName as MONO } from "./primitives";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@brightweblabs/ui";
import { cn } from "../lib/utils";
import { formatWeekday, isDueThisWeek, UpcomingMilestoneDay, buildUpcomingMilestoneDays } from "./dashboard-formatters";
import { useDashboardDictionary, useProjectBaseHref, buildDashboardProjectHref, ProjectAttentionCard } from "./dashboard-context";

export type Milestone = DashboardProjectMilestone & {
  day: string;
  date: string;
  code: string;
  highlight?: boolean;
};

export function buildMilestones(projects: DashboardProjectsData | null): Milestone[] {
  if (!projects) return [];
  const rows: Milestone[] = [];
  for (const milestone of projects.projects.milestones) {
    const d = new Date(milestone.targetDate);
    if (Number.isNaN(d.getTime())) continue;
    rows.push({
      ...milestone,
      day: formatWeekday(milestone.targetDate),
      date: String(d.getDate()).padStart(2, "0"),
      code: milestone.projectCode ?? milestone.projectId.slice(0, 8).toUpperCase(),
      highlight: isDueThisWeek(milestone.targetDate),
    });
  }
  return rows.slice(0, 6);
}

export function MilestonesPanel({ items, isLoading = false, className = "" }: { items: Milestone[]; isLoading?: boolean; className?: string }) {
  const dictionary = useDashboardDictionary();
  const projectBaseHref = useProjectBaseHref();
  return (
    <div className={`brand-panel relative flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-card)] p-6 text-[color:var(--project-hero-foreground)] ${className}`}>
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full blur-3xl opacity-100 dark:opacity-40"
        style={{ background: "var(--dashboard-milestone-glow)" }}
      />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className="flex h-[1.875rem] w-[1.875rem] items-center justify-center rounded-full"
            style={{ background: "var(--dashboard-milestone-icon)", color: "var(--accent)" }}
          >
            <Flag className="size-3.5" />
          </span>
          <h2 className="text-title font-semibold tracking-tight">{dictionary.milestones.title}</h2>
        </div>
        <span
          className="rounded-full border px-2 py-0.5 text-micro font-bold"
          style={{ borderColor: "var(--project-hero-border)", color: "var(--project-hero-muted)" }}
        >
          {items.length ? <span className="text-data">{items.length}</span> : dictionary.milestones.emptyBadge}
        </span>
      </div>
      {isLoading && items.length === 0 ? (
        <div className="relative mt-5 min-h-0 flex-1 space-y-2 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton
              key={i}
              rounded="0.75rem"
              className="h-12"
              style={{
                background:
                  "var(--dashboard-milestone-skeleton)",
              }}
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="relative flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-full"
            style={{ background: "var(--dashboard-milestone-empty)", color: "var(--project-hero-muted)" }}
          >
            <Flag className="h-5 w-5" />
          </span>
          <div>
            <p className="text-body font-semibold" style={{ color: "var(--project-hero-foreground)" }}>{dictionary.milestones.emptyTitle}</p>
            <p className="mt-0.5 text-meta" style={{ color: "var(--project-hero-muted)" }}>{dictionary.milestones.emptyDescription}</p>
          </div>
        </div>
      ) : (
        <ul className="relative mt-5 min-h-0 flex-1 space-y-1.5 overflow-hidden">
          {items.map((m) => (
            <li key={m.id}>
              <Link
                href={buildDashboardProjectHref(projectBaseHref, m.projectId)}
                prefetch={false}
                className="group relative flex items-center gap-3 rounded-[var(--radius-card)] py-1.5 pl-2 pr-3"
              >
                <span aria-hidden className="row-hover-sweep" />
                <div
                  className="relative flex h-12 w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-[var(--radius)] text-center leading-none"
                  style={
                    m.highlight
                      ? { background: "var(--accent)", color: "var(--accent-foreground)" }
                      : {
                          background: "var(--dashboard-milestone-date)",
                          color: "var(--project-hero-foreground)",
                        }
                  }
                >
                  <span className="block text-micro text-[length:var(--text-ui-nano-lg)] font-bold leading-none opacity-80">
                    {m.day}
                  </span>
                  <span className={`${MONO} block text-heading-4 font-extrabold leading-none`}>
                    {m.date}
                  </span>
                </div>
                <div className="relative min-w-0 flex-1">
                  <p className="truncate text-body text-[length:var(--text-ui-action)] font-semibold">{m.title}</p>
                  <p className="truncate text-meta" style={{ color: "var(--project-hero-muted)" }}>
                    {m.projectName} · <span className={MONO}>{m.code}</span>
                  </p>
                </div>
                <ArrowUpRight className="relative h-3.5 w-3.5 shrink-0 opacity-0 transition group-hover:opacity-70" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function buildProjectQuickCreateHref(baseHref: string) {
  const url = new URL(baseHref, "http://dashboard.local");
  url.searchParams.set("create", "project");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function ProjectQuickCreateAction({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <QuickCreateAction
      href={buildProjectQuickCreateHref(href)}
      label={label}
    />
  );
}

function PortfolioHealthCard({
  openProjects,
  onTrackCount,
  attentionCount,
  milestoneDays,
  isLoading,
}: {
  openProjects: number;
  onTrackCount: number;
  attentionCount: number;
  milestoneDays: UpcomingMilestoneDay[];
  isLoading: boolean;
}) {
  const dictionary = useDashboardDictionary();
  const attentionLabel = attentionCount === 1
    ? dictionary.projects.needsAttentionOne
    : dictionary.projects.needsAttentionMany;
  const milestonesDueThisWeek = milestoneDays.reduce((sum, day) => sum + day.count, 0);
  const healthStatus = openProjects === 0
    ? {
        label: dictionary.projects.healthStatusEmpty ?? "Sem projetos",
        dotClassName: "bg-[color:var(--project-hero-subtle)]",
        textClassName: "text-[color:var(--project-hero-subtle)]",
      }
    : attentionCount > 0
      ? {
          label: dictionary.projects.healthStatusAttention ?? "Requer atenção",
          dotClassName: "bg-[color:var(--project-risk-at-risk)]",
          textClassName: "text-[color:var(--project-hero-foreground)]",
        }
      : {
          label: dictionary.projects.healthStatusOnTrack ?? "No rumo",
          dotClassName: "bg-[color:var(--brand-lime,var(--project-state-active))]",
          textClassName: "text-[color:var(--project-hero-foreground)]",
        };

  return (
    <aside
      className="dashboard-projects-health brand-panel overflow-hidden rounded-[var(--radius-card)] p-6 text-[color:var(--project-hero-foreground)]"
      aria-labelledby="dashboard-project-health-title"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-[color:var(--dashboard-milestone-glow)] blur-3xl opacity-100 dark:opacity-40"
      />

      <div className="relative flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-[1.875rem] w-[1.875rem] shrink-0 items-center justify-center rounded-full bg-[color:var(--dashboard-milestone-icon)] text-[color:var(--accent)]"
          >
            <CircleDot aria-hidden className="size-3.5" />
          </span>
          <h2 id="dashboard-project-health-title" className="truncate text-title font-semibold tracking-tight">
            {dictionary.projects.healthTitle ?? "Resumo"}
          </h2>
        </div>
        {isLoading ? (
          <Skeleton className="h-6 w-24 shrink-0 rounded-full bg-[color:var(--project-hero-surface-raised)]" />
        ) : (
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--project-hero-border)] bg-[color:var(--project-hero-surface-raised)] px-2.5 py-1 text-micro font-semibold ${healthStatus.textClassName}`}
            data-health-status
          >
            <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${healthStatus.dotClassName}`} />
            {healthStatus.label}
          </span>
        )}
      </div>

      <div className="relative mt-7 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <strong className="text-kpi-lg text-[color:var(--project-hero-foreground)]">{isLoading ? "–" : openProjects}</strong>
        <span className="text-body text-[color:var(--project-hero-muted)]">{dictionary.projects.openProjects}</span>
      </div>

      <div
        className="relative mt-6 flex h-2 overflow-hidden rounded-full bg-[color:var(--project-hero-surface-raised)]"
        role="img"
        aria-label={`${onTrackCount} ${dictionary.projects.onTrack}; ${attentionCount} ${attentionLabel}`}
      >
        {onTrackCount > 0 ? (
          <span className="h-full min-w-1 bg-[color:var(--brand-lime,var(--project-state-active))] first:rounded-l-full last:rounded-r-full" style={{ flex: onTrackCount }} />
        ) : null}
        {attentionCount > 0 ? (
          <span className="h-full min-w-1 bg-[color:var(--project-risk-at-risk)] first:rounded-l-full last:rounded-r-full" style={{ flex: attentionCount }} />
        ) : null}
      </div>

      <div className="relative mt-4 space-y-2.5">
        <div className="flex items-center justify-between gap-4 text-label">
          <span className={cn("inline-flex items-center gap-2", onTrackCount === 0 ? "text-[color:var(--project-hero-subtle)]" : "text-[color:var(--project-hero-muted)]")}>
            <span aria-hidden className="h-2 w-2 rounded-full bg-[color:var(--brand-lime,var(--project-state-active))]" />
            {dictionary.projects.onTrack}
          </span>
          <strong className={cn("text-data-sm", onTrackCount === 0 ? "text-[color:var(--project-hero-subtle)]" : "text-[color:var(--project-hero-foreground)]")}>{onTrackCount}</strong>
        </div>
        <div className="flex items-center justify-between gap-4 text-label">
          <span className={cn("inline-flex items-center gap-2", attentionCount === 0 ? "text-[color:var(--project-hero-subtle)]" : "text-[color:var(--project-hero-foreground)]")}>
            <span aria-hidden className="h-2 w-2 rounded-full bg-[color:var(--project-risk-at-risk)]" />
            {attentionLabel}
          </span>
          <strong className={cn("text-data-sm", attentionCount === 0 ? "text-[color:var(--project-hero-subtle)]" : "text-[color:var(--project-hero-foreground)]")}>{attentionCount}</strong>
        </div>
      </div>

      <div className="relative my-6 border-t border-[color:var(--project-hero-border)]" />

      <div className="relative">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <strong className="text-kpi-lg text-[color:var(--project-hero-foreground)]">{isLoading ? "–" : milestonesDueThisWeek}</strong>
          <span className="text-body text-[color:var(--project-hero-muted)]">
            {milestonesDueThisWeek === 1
              ? (dictionary.projects.milestonePlannedOne ?? "meta prevista")
              : (dictionary.projects.milestonePlannedMany ?? dictionary.projects.milestonesWithDate ?? "metas previstas")}
          </span>
        </div>
        <span className="mt-1.5 block text-meta text-[color:var(--project-hero-subtle)]">
          {dictionary.projects.withinNextSevenDays ?? "nos próximos 7 dias"}
        </span>

        <div className="relative mt-5">
          <span aria-hidden className="absolute inset-x-4 top-3.5 h-px bg-[color:var(--project-hero-border)]" />
          <TooltipProvider delayDuration={80}>
            <ol className="relative grid grid-cols-7 gap-1" aria-label={`${milestonesDueThisWeek} ${milestonesDueThisWeek === 1 ? dictionary.projects.milestoneOne : dictionary.projects.milestoneMany}`}>
              {milestoneDays.map((day) => {
                const label = day.isToday ? (dictionary.projects.today ?? "Hoje") : day.weekday;
                const markerClassName = "relative flex h-7 w-7 items-center justify-center rounded-full text-data-sm";
                return (
                  <li key={day.dateKey} className="flex min-w-0 flex-col items-center gap-2">
                    {day.count > 0 ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className={`${markerClassName} touch-manipulation bg-[color:var(--accent)] text-[color:var(--accent-foreground)] transition-[filter,box-shadow] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--project-hero-foreground)]`}
                            aria-label={`${day.fullDate}: ${day.count} ${day.count === 1 ? dictionary.projects.milestoneOne : dictionary.projects.milestoneMany}. ${day.milestones.map((milestone) => `${milestone.title}, ${milestone.projectName}`).join("; ")}`}
                          >
                            {day.count}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="w-64 p-3">
                          <p className="text-label">{day.fullDate} · {day.count} {day.count === 1 ? dictionary.projects.milestoneOne : dictionary.projects.milestoneMany}</p>
                          <ul className="mt-2 space-y-2">
                            {day.milestones.map((milestone) => (
                              <li key={milestone.id}>
                                <p className="text-meta">{milestone.title}</p>
                                <p className="text-micro text-[color:var(--muted-foreground)]">{milestone.projectName}</p>
                              </li>
                            ))}
                          </ul>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span
                        className={`${markerClassName} border border-[color:var(--project-hero-border)] bg-[color:var(--project-hero-surface-raised)] text-[color:var(--project-hero-subtle)]`}
                        aria-label={`${label}: 0`}
                      >
                        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
                      </span>
                    )}
                    <span className={cn("truncate text-micro", day.count > 0 ? "text-[color:var(--project-hero-muted)]" : "text-[color:var(--project-hero-subtle)]")}>{label}</span>
                  </li>
                );
              })}
            </ol>
          </TooltipProvider>
        </div>
      </div>
    </aside>
  );
}

export function ProjectsView({ projects, isLoading }: { projects: DashboardProjectsData | null; isLoading: boolean }) {
  const dictionary = useDashboardDictionary();
  const projectBaseHref = useProjectBaseHref();
  const kpis = projects?.kpis;
  const attention = projects?.projects.attention ?? [];
  const milestoneDays = buildUpcomingMilestoneDays(
    projects?.projects.milestonesNext7Days ?? projects?.projects.milestones ?? [],
  );
  const openProjects = (kpis?.projectsOnTrack ?? 0) + (kpis?.projectsAttention ?? 0);
  const hiddenAttentionCount = Math.max(0, (kpis?.projectsAttention ?? 0) - attention.length);
  const onTrackCount = Math.max(0, kpis?.projectsOnTrack ?? 0);
  const attentionCount = Math.max(0, kpis?.projectsAttention ?? 0);

  return (
    <div className="space-y-6">
      <PortalSectionHeading
        title={dictionary.projects.stateTitle}
        subtitle={dictionary.projects.stateSubtitle}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <PortalActionLink href={projectBaseHref} prefetch={false}>
              {dictionary.projects.viewAll}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </PortalActionLink>
            <ProjectQuickCreateAction
              href={projectBaseHref}
              label={dictionary.projects.addNew ?? "Novo projeto"}
            />
          </div>
        }
      />

      <div className="dashboard-projects-grid">
        <PortfolioHealthCard
          openProjects={openProjects}
          onTrackCount={onTrackCount}
          attentionCount={attentionCount}
          milestoneDays={milestoneDays}
          isLoading={isLoading && !projects}
        />

        <Card asChild>
          <section className="dashboard-projects-attention overflow-hidden" aria-labelledby="dashboard-project-attention">
          <div className="flex min-h-16 items-center justify-between border-b border-[color:var(--border)] px-5 py-4">
            <h3 id="dashboard-project-attention" className={CARD_TITLE}>{dictionary.projects.attentionQueueTitle}</h3>
            <DashboardCountPill count={kpis?.projectsAttention ?? 0} tone="warning" />
          </div>

          {isLoading && attention.length === 0 ? (
            <div>
              {[0, 1, 2].map((index) => <Skeleton key={index} className="h-32 border-b border-[color:var(--border)] last:border-b-0" rounded="0" />)}
            </div>
          ) : attention.length === 0 ? (
            <DashboardEmptyState
              className="min-h-64 flex-1 bg-[color:var(--project-surface-secondary)]"
              icon={(
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--project-health-on-track)] text-[color:var(--primary-foreground)]">
                  <CheckCircle2 aria-hidden className="h-5 w-5" />
                </span>
              )}
              title={dictionary.projects.allOnTrackTitle}
              description={dictionary.projects.allOnTrackDescription(kpis?.projectsActive ?? 0)}
            />
          ) : (
            <div>
              {attention.map((project, index) => <ProjectAttentionCard key={project.id} project={project} rank={index + 1} />)}
              {hiddenAttentionCount > 0 ? (
                <div className="flex justify-center border-t border-[color:var(--border)] px-5 py-3">
                  <Link href={projectBaseHref} prefetch={false} className="text-meta font-semibold text-[color:var(--primary)] hover:underline">
                    {dictionary.projects.moreAttention(hiddenAttentionCount)}
                  </Link>
                </div>
              ) : null}
            </div>
          )}
          </section>
        </Card>
      </div>
    </div>
  );
}
