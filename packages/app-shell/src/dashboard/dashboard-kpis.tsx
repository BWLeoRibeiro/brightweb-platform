"use client";

import Link from "next/link";
import { BriefcaseBusiness, Users } from "lucide-react";
import { Card, Skeleton } from "@brightweblabs/ui";
import type { DashboardCrmData, DashboardProjectsData } from "./types";
import { dashboardLabelClassName as LABEL, dashboardMonoTabularClassName as MONO } from "./primitives";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@brightweblabs/ui";
import { VisualTone, TONE_COLOR } from "./dashboard-formatters";
import { useDashboardDictionary, useProjectBaseHref } from "./dashboard-context";

type KpiBreakdownItem = { label: string; tone: VisualTone; value: number };

function KpiBreakdownBar({ items }: { items: KpiBreakdownItem[] }) {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.value), 0);

  return (
    <div className="mt-5">
      <TooltipProvider delayDuration={80}>
        <div className="flex h-2 overflow-hidden rounded-full" style={{ background: "var(--dashboard-breakdown-track)" }}>
          {total > 0 && items.map((item) => item.value > 0 ? (
            <Tooltip key={item.label}>
              <TooltipTrigger asChild>
                <span
                  className="h-full cursor-default transition-[filter] duration-150 first:rounded-l-full last:rounded-r-full hover:brightness-110"
                  style={{ width: `${(item.value / total) * 100}%`, background: TONE_COLOR[item.tone] }}
                />
              </TooltipTrigger>
              <TooltipContent>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-[2px]" style={{ background: TONE_COLOR[item.tone] }} />
                  <span className="capitalize">{item.label}</span>
                  <span className="text-data font-bold">{item.value}</span>
                </span>
              </TooltipContent>
            </Tooltip>
          ) : null)}
        </div>
      </TooltipProvider>
      <div className="mt-3.5 grid grid-cols-2 gap-x-6 gap-y-1.5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-2 text-meta">
            <span className="flex min-w-0 items-center gap-2 text-[color:var(--muted-foreground)]">
              <span className="h-1.5 w-1.5 shrink-0 rounded-[2px]" style={{ background: TONE_COLOR[item.tone] }} />
              <span className="truncate">{item.label}</span>
            </span>
            <span className={`${MONO} text-body text-[length:var(--text-ui-action)] font-bold text-[color:var(--foreground)]`}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProjectsKpiCard({ projects, isLoading }: { projects: DashboardProjectsData | null; isLoading: boolean }) {
  const dictionary = useDashboardDictionary();
  const projectBaseHref = useProjectBaseHref();
  const kpis = projects?.kpis;
  const showLoading = isLoading && !projects;
  return (
    <Card asChild variant="interactive" density="default">
      <Link href={projectBaseHref} prefetch={false} className="group relative overflow-hidden p-6">
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-[color:var(--accent)]" />
      <div className="flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--dashboard-accent-soft)] text-[color:var(--accent)]">
          <BriefcaseBusiness aria-hidden className="h-4 w-4" />
        </span>
        <span className={LABEL}>{dictionary.projects.title}</span>
      </div>
      {showLoading ? (
        <div className="mt-4 space-y-5" aria-hidden="true">
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-kpi-lg text-foreground">{kpis?.projectsActive ?? 0}</span>
            <span className="text-body font-semibold text-[color:var(--muted-foreground)]">{dictionary.projects.active}</span>
          </div>
          <KpiBreakdownBar items={[
            { label: dictionary.projects.atRisk, tone: "watch", value: kpis?.projectsAtRisk ?? 0 },
            { label: dictionary.projects.overdue, tone: "risk", value: kpis?.projectsOverdue ?? 0 },
            { label: dictionary.projects.dueSevenDays, tone: "accent", value: kpis?.projectsDueNext7Days ?? 0 },
            { label: dictionary.projects.noOwner, tone: "watch", value: kpis?.projectsWithoutOwner ?? 0 },
          ]} />
        </>
      )}
      </Link>
    </Card>
  );
}

export function CrmKpiCard({ crm, isLoading }: { crm: DashboardCrmData | null; isLoading: boolean }) {
  const dictionary = useDashboardDictionary();
  const kpis = crm?.kpis;
  const breakdown = crm?.crm.statusBreakdown;
  const showLoading = isLoading && !crm;
  return (
    <Card asChild variant="interactive" density="default">
      <Link href="/crm" prefetch={false} className="group relative overflow-hidden p-6">
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-[color:var(--dashboard-neutral-rule)]" />
      <div className="flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--muted)] text-[color:var(--muted-foreground)]">
          <Users aria-hidden className="h-4 w-4" />
        </span>
        <span className={LABEL}>{dictionary.crm.title}</span>
      </div>
      {showLoading ? (
        <div className="mt-4 space-y-5" aria-hidden="true">
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-kpi-lg text-foreground">{kpis?.crmTotalContacts ?? 0}</span>
            <span className="text-body font-semibold text-[color:var(--muted-foreground)]">{dictionary.crm.contacts}</span>
          </div>
          <KpiBreakdownBar items={[
            { label: dictionary.crm.newSevenDays, tone: "on", value: kpis?.crmNewLast7Days ?? 0 },
            { label: dictionary.crm.noOwner, tone: "watch", value: kpis?.crmUnassignedContacts ?? 0 },
            { label: dictionary.crm.proposals, tone: "accent", value: breakdown?.proposal ?? 0 },
            { label: dictionary.crm.won, tone: "on", value: breakdown?.won ?? 0 },
          ]} />
        </>
      )}
      </Link>
    </Card>
  );
}


export function RhythmPeriodRow({ label, value, isLoading }: { label: string; value: number; isLoading: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <span className="text-meta text-[color:var(--project-hero-muted)]">{label}</span>
      <span className={`${MONO} text-body font-bold text-[color:var(--project-hero-foreground)]`}>{isLoading ? "–" : value}</span>
    </div>
  );
}
