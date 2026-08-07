"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Flag,
  Plus,
  Users,
} from "lucide-react";

import { Card, Skeleton } from "@brightweblabs/ui";
import type { DashboardAssignedTask, DashboardCrmData, DashboardCrmRecentContact, DashboardDataClient, DashboardInitialData, DashboardProjectAttentionItem, DashboardProjectComponents, DashboardProjectItem, DashboardProjectMilestone, DashboardProjectsData, DashboardSection, DashboardSurfaceContribution, DashboardTaskAttentionState, DashboardTasksData } from "./types";
import { useDashboardData, type DashboardState } from "./use-dashboard-data";
import { defaultDashboardDictionary, type DashboardDictionary } from "./dictionary";
import { DashboardActionLink as PortalActionLink, DashboardSectionHeading as PortalSectionHeading, dashboardCardTitleClassName as CARD_TITLE, dashboardLabelClassName as LABEL, dashboardMonoTabularClassName as MONO } from "./primitives";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@brightweblabs/ui";
import { cn } from "../lib/utils";
import { PillTabs } from "../components/pill-tabs";


const ProjectComponentsContext = createContext<DashboardProjectComponents | null>(null);
const DashboardDictionaryContext = createContext<DashboardDictionary>(defaultDashboardDictionary);
function useProjectComponents() { return useContext(ProjectComponentsContext); }
function useDashboardDictionary() { return useContext(DashboardDictionaryContext); }
function useProjectBaseHref() { return useProjectComponents()?.projectBaseHref ?? "/projects"; }
function projectHref(baseHref: string, projectId?: string) { return projectId ? `${baseHref}/${projectId}` : baseHref; }
function ProjectAttentionCard({ project, rank }: { project: DashboardProjectAttentionItem; rank: number }) { const value = useProjectComponents(); return value?.ProjectAttentionCard ? <value.ProjectAttentionCard project={project} rank={rank} /> : value ? <value.ProjectSummaryCard project={project} /> : null; }
function DashboardTaskListRow(props: { task: DashboardAssignedTask; href: string; attentionState?: DashboardTaskAttentionState; attentionLabel?: string }) { const value = useProjectComponents(); return value ? <value.DashboardTaskRow {...props} /> : null; }

/* ──────────────────────────────────────────────────────────────────
   V6 — real data. Welcome → hero 4-card grid →
   activity table (grouped) + milestones. Projects/Clients/Actions
   tabs render from live endpoints. Hours stays mocked.
   ────────────────────────────────────────────────────────────────── */

// TODO(dashboard-hours): wire real data source

type TabKey = "overview" | "projects" | "clients" | "tasks";

/* ─── Shared tokens ──────────────────────────────────────────────── */

type VisualTone = "on" | "watch" | "risk" | "accent";

const TONE_COLOR: Record<VisualTone, string> = {
  on: "var(--project-state-active)",
  watch: "var(--project-risk-at-risk)",
  risk: "var(--project-risk-overdue)",
  accent: "var(--accent)",
};

/* ─── Helpers ────────────────────────────────────────────────────── */

function getGreeting(h: number, dictionary: DashboardDictionary) {
  if (h < 13) return dictionary.greeting.morning;
  if (h < 19) return dictionary.greeting.afternoon;
  return dictionary.greeting.evening;
}

function formatFullDate(d: Date, dictionary: DashboardDictionary) {
  const weekday = new Intl.DateTimeFormat("pt-PT", { weekday: "long" }).format(d);
  const dow = weekday.charAt(0).toLocaleUpperCase("pt-PT") + weekday.slice(1);
  const month = new Intl.DateTimeFormat("pt-PT", { month: "long" }).format(d);
  return `${dow}, ${d.getDate()} ${dictionary.date.joiner} ${month}`;
}

function formatShortDate(iso: string | null | undefined) {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short" }).format(d);
}

function formatWeekday(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-PT", { weekday: "short" }).format(d).replace(".", "");
}

function initialsOf(name: string | null | undefined, fallback = "?") {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function healthToTone(h: DashboardProjectItem["health"]): VisualTone {
  if (h === "on_track") return "on";
  if (h === "at_risk") return "watch";
  return "risk";
}

function isDueThisWeek(iso: string | null) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const now = Date.now();
  return t >= now && t <= now + 7 * 24 * 60 * 60 * 1000;
}

type UpcomingMilestoneDay = {
  dateKey: string;
  weekday: string;
  fullDate: string;
  isToday: boolean;
  count: number;
  milestones: DashboardProjectMilestone[];
};

function calendarDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildUpcomingMilestoneDays(
  milestones: DashboardProjectMilestone[],
  now = new Date(),
): UpcomingMilestoneDay[] {
  const milestonesByDate = new Map<string, DashboardProjectMilestone[]>();
  for (const milestone of milestones) {
    const dateKey = /^\d{4}-\d{2}-\d{2}/.exec(milestone.targetDate)?.[0];
    if (!dateKey) continue;
    const items = milestonesByDate.get(dateKey);
    if (items) items.push(milestone);
    else milestonesByDate.set(dateKey, [milestone]);
  }

  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const dateKey = calendarDateKey(date);
    const milestonesForDay = milestonesByDate.get(dateKey) ?? [];
    const formattedDate = new Intl.DateTimeFormat("pt-PT", { weekday: "long", day: "numeric", month: "long" }).format(date);
    return {
      dateKey,
      weekday: new Intl.DateTimeFormat("pt-PT", { weekday: "short" }).format(date).replace(".", "").slice(0, 3),
      fullDate: formattedDate.charAt(0).toLocaleUpperCase("pt-PT") + formattedDate.slice(1),
      isToday: index === 0,
      count: milestonesForDay.length,
      milestones: milestonesForDay,
    };
  });
}

/* ─── Welcome + Tabs ─────────────────────────────────────────────── */

function HeroMetricMini({ value, label, tone }: { value: number; label: string; tone: "risk" | "on" | "neutral" }) {
  const dot = tone === "risk"
    ? "var(--project-risk-overdue)"
    : tone === "on"
      ? "var(--project-state-active)"
      : "var(--project-hero-subtle)";
  return (
    <Card
      density="compact"
      className="flex-row items-center justify-between gap-4 px-4 py-2.5 shadow-none"
      style={{ borderColor: "var(--project-hero-border)", background: "var(--project-hero-surface-raised)" }}
    >
      <span className="inline-flex items-center gap-2 text-meta" style={{ color: "var(--project-hero-muted)" }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
        {label}
      </span>
      <span
        className="text-kpi text-[length:var(--text-ui-dashboard-card-title)] font-extrabold leading-none tracking-[var(--type-tracking-n030)]"
        style={{ color: "var(--project-hero-foreground)" }}
      >
        {value}
      </span>
    </Card>
  );
}

function HeroMetrics({ activeProjects, overdueProjects, newLeads }: { activeProjects: number; overdueProjects: number; newLeads: number }) {
  const dictionary = useDashboardDictionary();
  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:w-auto lg:min-w-[330px]">
      <Card
        density="default"
        className="min-w-[150px] justify-center px-5 py-4 shadow-none"
        style={{ borderColor: "var(--project-hero-border)", background: "var(--project-hero-surface-raised)" }}
      >
        <span
          className="text-kpi-lg text-[length:var(--text-ui-dashboard-metric)] font-black leading-[var(--type-leading-090)] tracking-[var(--type-tracking-n050)]"
          style={{ color: "var(--project-hero-foreground)" }}
        >
          {activeProjects}
        </span>
        <span className="mt-1.5 text-meta" style={{ color: "var(--project-hero-muted)" }}>
          {activeProjects === 1
            ? (dictionary.welcome.activeProjectOne ?? dictionary.welcome.activeProjects.replace(/^projetos ativos$/, "projeto ativo"))
            : (dictionary.welcome.activeProjectMany ?? dictionary.welcome.activeProjects)}
        </span>
      </Card>
      <div className="flex flex-col justify-between gap-3">
        <HeroMetricMini value={overdueProjects} label={dictionary.welcome.overdueProjects} tone={overdueProjects > 0 ? "risk" : "neutral"} />
        <HeroMetricMini value={newLeads} label={dictionary.welcome.newLeads} tone="on" />
      </div>
    </div>
  );
}

function WelcomeHeader({
  name,
  urgentCount,
  unownedProjects,
  errors,
  activeProjects,
  overdueProjects,
  newLeads,
}: {
  name: string;
  urgentCount: number;
  unownedProjects: number;
  errors: string[];
  activeProjects: number;
  overdueProjects: number;
  newLeads: number;
}) {
  const dictionary = useDashboardDictionary();
  const [now, setNow] = useState<Date | null>(null);
  const greeting = now ? getGreeting(now.getHours(), dictionary) : dictionary.greeting.fallback;
  const dateLabel = now ? formatFullDate(now, dictionary) : dictionary.greeting.loadingDate;
  const time = now ? now.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }) : "--:--";
  const allAttentionIsMissingOwners = unownedProjects > 0 && urgentCount === unownedProjects;

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const interval = window.setInterval(update, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <header className="brand-panel relative overflow-hidden rounded-[var(--radius-panel)] p-6 text-[color:var(--project-hero-foreground)] md:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full blur-3xl opacity-100 dark:opacity-40"
        style={{ background: "var(--dashboard-hero-glow)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: "var(--dashboard-hero-highlight)" }}
      />

      <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 lg:flex-1">
          <p
            className="inline-flex items-center gap-2 text-meta font-semibold"
            style={{ color: "var(--project-hero-muted)" }}
          >
            <CalendarDays className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
            <span className="text-data">{dateLabel}</span>
            <span className="opacity-40">·</span>
            <span className="text-data">{time}</span>
          </p>

          <h1 className="font-display mt-4 text-heading-1 text-[length:var(--text-ui-dashboard-title)] font-extrabold leading-[var(--type-leading-102)] tracking-[var(--type-tracking-n035)] md:text-[length:var(--text-ui-dashboard-title-lg)]">
            {greeting}
            {name ? (
              <>
                , <span style={{ color: "var(--accent)" }}>{name}</span>
              </>
            ) : (
              ""
            )}
            .
          </h1>

          <p className="mt-3 max-w-[32rem] text-body-lg" style={{ color: "var(--project-hero-muted)" }}>
            {allAttentionIsMissingOwners ? (
              <>
                <span className="font-semibold" style={{ color: "var(--project-hero-foreground)" }}>
                  {unownedProjects} {unownedProjects === 1 ? (dictionary.welcome.projectOne ?? "projeto") : (dictionary.welcome.projectMany ?? "projetos")}
                </span>{" "}
                {unownedProjects === 1 ? (dictionary.welcome.needsOwnerOne ?? "precisa de responsável.") : (dictionary.welcome.needsOwnerMany ?? "precisam de responsável.")}
              </>
            ) : urgentCount > 0 ? (
              <>
                <span className="font-semibold" style={{ color: "var(--project-hero-foreground)" }}>
                  {urgentCount} {urgentCount === 1 ? dictionary.welcome.urgentOne : dictionary.welcome.urgentMany}
                </span>{" "}
                {dictionary.welcome.attentionToday}
              </>
            ) : (
              dictionary.welcome.allClear
            )}
          </p>

          {errors.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2" role="status">
              {errors.map((error) => (
                <span
                  key={error}
                  className="dashboard-error inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-meta font-semibold leading-snug"
                >
                  <AlertTriangle className="h-3 w-3" />
                  {error}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <HeroMetrics activeProjects={activeProjects} overdueProjects={overdueProjects} newLeads={newLeads} />
      </div>
    </header>
  );
}

function TabsRow({ value, onChange, sections }: { value: TabKey; onChange: (v: TabKey) => void; sections: DashboardSection[] }) {
  const dictionary = useDashboardDictionary();
  const tabs: { key: TabKey; label: string }[] = [
    { key: "overview", label: dictionary.tabs.overview },
    ...(sections.includes("projects") ? [{ key: "projects" as const, label: dictionary.tabs.projects }] : []),
    ...(sections.includes("crm") ? [{ key: "clients" as const, label: dictionary.tabs.clients }] : []),
    ...(sections.includes("tasks") ? [{ key: "tasks" as const, label: dictionary.tabs.tasks }] : []),
  ];

  return <PillTabs ariaLabel="Dashboard" items={tabs.map((tab) => ({ value: tab.key, label: tab.label }))} value={value} onValueChange={onChange} />;
}

/* ─── Hero cards ─────────────────────────────────────────────────── */

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

function ProjectsKpiCard({ projects, isLoading }: { projects: DashboardProjectsData | null; isLoading: boolean }) {
  const dictionary = useDashboardDictionary();
  const projectBaseHref = useProjectBaseHref();
  const kpis = projects?.kpis;
  const showLoading = isLoading && !projects;
  return (
    <Card asChild variant="interactive" density="default">
      <Link href={projectBaseHref} prefetch={false} className="group relative overflow-hidden p-6">
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ background: "var(--accent)" }} />
      <div className="flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: "var(--dashboard-accent-soft)", color: "var(--accent)" }}>
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
            { label: dictionary.projects.noOwner, tone: "on", value: kpis?.projectsWithoutOwner ?? 0 },
          ]} />
        </>
      )}
      </Link>
    </Card>
  );
}

function CrmKpiCard({ crm, isLoading }: { crm: DashboardCrmData | null; isLoading: boolean }) {
  const dictionary = useDashboardDictionary();
  const kpis = crm?.kpis;
  const breakdown = crm?.crm.statusBreakdown;
  const showLoading = isLoading && !crm;
  return (
    <Card asChild variant="interactive" density="default">
      <Link href="/crm" className="group relative overflow-hidden p-6">
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ background: "var(--dashboard-neutral-rule)" }} />
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

/* ─── Activity table ─────────────────────────────────────────────── */

type TaskRow = {
  id: string;
  code: string;
  name: string;
  group: "blocked" | "overdue" | "today" | "soon" | "later";
  task: DashboardAssignedTask;
  status: DashboardAssignedTask["status"];
  priority: DashboardAssignedTask["priority"];
  blockedReason: string | null;
  dueDate: string | null;
  href: string;
};

// Each group header carries a hint of its urgency, mirroring the project-detail
// tasks bento (project-milestone-task-lists): overdue red, due-soon amber, in
// flight a quiet neutral.
const GROUP_HEADER_TONE: Record<TaskRow["group"], { header: string; label: string; dot: string }> = {
  blocked: {
    header:
      "bg-[color:var(--dashboard-task-risk-bg)] hover:bg-[color:var(--dashboard-task-risk-hover)]",
    label: "text-[color:var(--project-state-blocked-strong)]",
    dot: "bg-[color:var(--project-state-blocked)]",
  },
  overdue: {
    header:
      "bg-[color:var(--dashboard-task-risk-bg)] hover:bg-[color:var(--dashboard-task-risk-hover)]",
    label: "text-[color:var(--project-risk-overdue-strong)]",
    dot: "bg-[color:var(--project-risk-overdue)]",
  },
  today: {
    header:
      "bg-[color:var(--dashboard-task-due-bg)] hover:bg-[color:var(--dashboard-task-due-hover)]",
    label: "text-[color:var(--project-risk-at-risk-strong)]",
    dot: "bg-[color:var(--project-risk-at-risk)]",
  },
  soon: {
    header:
      "bg-[color:var(--dashboard-task-due-bg)] hover:bg-[color:var(--dashboard-task-due-hover)]",
    label: "text-[color:var(--project-risk-at-risk-strong)]",
    dot: "bg-[color:var(--project-risk-at-risk)]",
  },
  later: {
    header:
      "bg-[color:var(--dashboard-task-flight-bg)] hover:bg-[color:var(--dashboard-task-flight-hover)]",
    label: "text-[color:var(--muted-foreground)]",
    dot: "bg-foreground/30",
  },
};

// Keep urgency labels compact without forcing a shouty all-caps treatment.
const TASK_GROUP_LABEL_BASE = "text-label font-semibold";

function dateOnly(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function attentionStateFromTask(task: DashboardAssignedTask, generatedAt: string): DashboardTaskAttentionState | null {
  if (task.status === "blocked") return "blocked";
  if (!task.dueDate) return null;
  const today = dateOnly(generatedAt);
  if (!today) return null;
  const next = new Date(`${today}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 7);
  const next7Days = next.toISOString().slice(0, 10);
  if (task.dueDate < today) return "overdue";
  if (task.dueDate === today) return "today";
  if (task.dueDate <= next7Days) return "soon";
  return null;
}

function groupFromTask(task: DashboardAssignedTask, generatedAt: string): TaskRow["group"] {
  return attentionStateFromTask(task, generatedAt) ?? "later";
}

function buildTasks(tasks: DashboardTasksData | null, projectBaseHref: string): TaskRow[] {
  if (!tasks) return [];
  return tasks.tasks.map((task) => ({
    id: `task-${task.id}`,
    code: task.projectCode ?? task.projectName.slice(0, 12).toUpperCase(),
    name: task.title,
    group: groupFromTask(task, tasks.generatedAt),
    task,
    status: task.status,
    priority: task.priority,
    blockedReason: task.blockedReason,
    dueDate: task.dueDate,
    href: projectHref(projectBaseHref, task.projectId),
  }));
}

function TasksTable({
  rows,
  title,
  isLoading,
  total,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  className = "",
  bodyClassName = "",
}: {
  rows: TaskRow[];
  title?: string;
  isLoading: boolean;
  total?: number;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  className?: string;
  bodyClassName?: string;
}) {
  const dictionary = useDashboardDictionary();
  const groups: TaskRow["group"][] = ["blocked", "overdue", "today", "soon", "later"];
  const groupLabel: Record<TaskRow["group"], string> = {
    blocked: dictionary.tasks.blocked,
    overdue: dictionary.tasks.overdue,
    today: dictionary.tasks.dueToday,
    soon: dictionary.tasks.dueThisWeek,
    later: dictionary.tasks.later,
  };

  return (
    <Card className={`min-h-0 overflow-hidden ${className}`}>
      <header className="flex shrink-0 items-center justify-between border-b border-[color:var(--border)] px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="project-section-icon">
            <CircleDot className="size-3.5" />
          </span>
          <div>
            <h2 className={CARD_TITLE}>{title ?? dictionary.tasks.title}</h2>
            <p className="text-meta text-[color:var(--muted-foreground)]">{dictionary.tasks.groupedByUrgency}</p>
          </div>
        </div>
        {isLoading && rows.length === 0 ? (
          <Skeleton className="h-[26px] w-16 rounded-full" />
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--accent)]/30 bg-[color:var(--accent)]/10 px-2.5 py-1 text-label font-bold text-[color:var(--accent)]">
            <span className="text-data">{total ?? rows.length}</span> {dictionary.tasks.active}
          </span>
        )}
      </header>

      <div className={`min-h-0 ${bodyClassName}`}>
        {isLoading && rows.length === 0 ? (
          // Mirror the loaded layout (tinted group header + two-line rows) so the
          // swap from skeleton to content stays geometrically stable — no jump.
          <div>
            <div className="flex items-center gap-2 bg-[color:var(--dashboard-task-flight-bg)] px-5 py-1.5">
              <Skeleton className="h-1.5 w-1.5 rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex flex-col gap-1.5 border-t border-[color:var(--border)] px-5 py-2.5 first:border-t-0">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-3 w-12" />
                </div>
                <div className="flex items-center gap-1.5">
                  <Skeleton className="h-4 w-14 rounded-full" />
                  <Skeleton className="h-4 w-20 rounded-full" />
                  <Skeleton className="ml-auto h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-10 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--muted)] text-[color:var(--muted-foreground)]">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-body font-semibold text-[color:var(--foreground)]">{dictionary.tasks.allClear}</p>
              <p className="mt-0.5 text-meta text-[color:var(--muted-foreground)]">{dictionary.tasks.urgentEmpty}</p>
            </div>
          </div>
        ) : (
          groups.map((g) => {
            const gr = rows.filter((r) => r.group === g);
            if (gr.length === 0) return null;
            const tone = GROUP_HEADER_TONE[g];
            return (
              <section key={g} className="border-b border-[color:var(--border)] last:border-b-0">
                <div className={cn("flex items-center gap-2 px-5 py-1.5", tone.header)}>
                  <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", tone.dot)} />
                  <span className={cn(TASK_GROUP_LABEL_BASE, "min-w-0 flex-1", tone.label)}>
                    {groupLabel[g]}
                  </span>
                  <span className={`${MONO} text-micro text-[color:var(--muted-foreground)]`}>{gr.length}</span>
                </div>
                {gr.map((r) => (
                  <DashboardTaskListRow
                    key={r.id}
                    task={r.task}
                    href={r.href}
                    attentionState={r.group === "later" ? undefined : r.group}
                    attentionLabel={r.group === "later" || r.group === "blocked" ? undefined : groupLabel[r.group]}
                  />
                ))}
              </section>
            );
          })
        )}
      </div>
      {hasMore ? (
        <div className="flex shrink-0 justify-center border-t border-[color:var(--border)] px-5 py-3">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="text-body rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 font-semibold text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] disabled:cursor-wait disabled:opacity-60"
          >
            {isLoadingMore ? dictionary.tasks.loadingMore : dictionary.tasks.loadMore}
          </button>
        </div>
      ) : null}
    </Card>
  );
}

/* ─── Milestones panel ───────────────────────────────────────────── */

type Milestone = DashboardProjectMilestone & {
  day: string;
  date: string;
  code: string;
  highlight?: boolean;
};

function buildMilestones(projects: DashboardProjectsData | null): Milestone[] {
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

function MilestonesPanel({ items, isLoading = false, className = "" }: { items: Milestone[]; isLoading?: boolean; className?: string }) {
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
                href={projectHref(projectBaseHref, m.projectId)}
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

/* ─── Projects tab ───────────────────────────────────────────────── */

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
    <Link
      href={buildProjectQuickCreateHref(href)}
      prefetch={false}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[color:var(--surface-button-brand)] px-3.5 py-1.5 text-meta font-semibold text-[color:var(--accent-foreground)] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current [&_svg]:h-3.5 [&_svg]:w-3.5"
    >
      <Plus />
      {label}
    </Link>
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
        className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full blur-3xl opacity-100 dark:opacity-40"
        style={{ background: "var(--dashboard-milestone-glow)" }}
      />

      <div className="relative flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-[1.875rem] w-[1.875rem] shrink-0 items-center justify-center rounded-full"
            style={{ background: "var(--dashboard-milestone-icon)", color: "var(--accent)" }}
          >
            <CircleDot aria-hidden className="size-3.5" />
          </span>
          <h2 id="dashboard-project-health-title" className="truncate text-title font-semibold">
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
            <h3 id="dashboard-project-attention" className={LABEL}>{dictionary.projects.attentionQueueTitle}</h3>
            <span className="dashboard-attention-count">
              {kpis?.projectsAttention ?? 0}
            </span>
          </div>

          {isLoading && attention.length === 0 ? (
            <div>
              {[0, 1, 2].map((index) => <Skeleton key={index} className="h-32 border-b border-[color:var(--border)] last:border-b-0" rounded="0" />)}
            </div>
          ) : attention.length === 0 ? (
            <div className="flex min-h-64 flex-col justify-center bg-[color:var(--project-surface-secondary)] px-7 py-8">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--project-health-on-track)] text-[color:var(--primary-foreground)]">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-title font-bold text-[color:var(--foreground)]">{dictionary.projects.allOnTrackTitle}</h3>
              <p className="mt-1 text-body text-[color:var(--muted-foreground)]">{dictionary.projects.allOnTrackDescription(kpis?.projectsActive ?? 0)}</p>
            </div>
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

/* ─── Clients tab ────────────────────────────────────────────────── */

type TagMeta = { label: string; color: string; strong: string };

function Tag({ meta }: { meta: TagMeta }) {
  return (
    <span
      className="tint-soft inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-micro font-bold"
      style={{ ["--tint" as string]: meta.color, ["--tint-strong" as string]: meta.strong }}
    >
      <span className="dashboard-status-dot h-1.5 w-1.5 rounded-full" />
      {meta.label}
    </span>
  );
}

function crmStatusMeta(status: string, dictionary: DashboardDictionary): TagMeta {
  const labels = dictionary.crm.statuses;
  const values: Record<string, TagMeta> = {
    lead: { label: labels.lead, color: "var(--dashboard-status-lead)", strong: "var(--semantic-info-strong)" },
    qualified: { label: labels.qualified, color: "var(--dashboard-status-qualified)", strong: "var(--semantic-warning-strong)" },
    proposal: { label: labels.proposal, color: "var(--dashboard-status-proposal)", strong: "var(--foreground)" },
    won: { label: labels.won, color: "var(--dashboard-status-won)", strong: "var(--semantic-success-strong)" },
    lost: { label: labels.lost, color: "var(--dashboard-status-lost)", strong: "var(--semantic-neutral-strong)" },
  };
  return values[status] ?? values.lead!;
}

function formatMonthShort(isoMonth: string) {
  const d = new Date(`${isoMonth}-01T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoMonth;
  return new Intl.DateTimeFormat("pt-PT", { month: "short", timeZone: "UTC" }).format(d).replace(".", "");
}

function RhythmSparkline({ series }: { series: { month: string; count: number }[] }) {
  const max = Math.max(1, ...series.map((p) => p.count));
  const w = 560;
  const h = 64;
  const step = series.length > 1 ? w / (series.length - 1) : w;
  const points = series
    .map((p, i) => `${(i * step).toFixed(1)},${(h - 4 - (p.count / max) * (h - 8)).toFixed(1)}`)
    .join(" ");
  return (
    <div aria-hidden className="min-w-0">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-16 w-full">
        <polyline
          points={points}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-1.5 flex justify-between text-micro text-[color:var(--muted-foreground)]">
        {series.map((p) => (
          <span key={p.month}>{formatMonthShort(p.month)}</span>
        ))}
      </div>
    </div>
  );
}

function RhythmPeriodRow({ label, value, isLoading }: { label: string; value: number; isLoading: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <span className="text-meta text-[color:var(--muted-foreground)]">{label}</span>
      <span className={`${MONO} text-body font-semibold text-[color:var(--foreground)]`}>{isLoading ? "–" : value}</span>
    </div>
  );
}

function RhythmCard({ crm, isLoading }: { crm: DashboardCrmData | null; isLoading: boolean }) {
  const dictionary = useDashboardDictionary();
  const kpis = crm?.kpis;
  const series = crm?.crm.monthlyNewContacts ?? [];
  const monthValue = series.length > 0 ? series[series.length - 1]!.count : kpis?.crmNewLast30Days ?? 0;
  const previousMonth = series.length > 1 ? series[series.length - 2]!.count : null;
  const delta = previousMonth === null ? null : monthValue - previousMonth;
  return (
    <Card density="default" className="relative overflow-hidden p-6">
      <span
        aria-hidden
        className="absolute right-0 top-0 h-20 w-20 rounded-full blur-2xl"
        style={{ background: "var(--dashboard-period-glow)" }}
      />
      <div className={`relative grid grid-cols-1 gap-6 md:items-center ${series.length > 0 ? "md:grid-cols-[auto_1fr] lg:grid-cols-[auto_1fr_auto]" : "md:grid-cols-[1fr_auto]"}`}>
        <div className="flex flex-col items-start md:min-w-[12rem]">
          <span className={LABEL}>{series.length > 0 ? dictionary.clients.thisMonth ?? "Este mês" : dictionary.clients.lastThirtyDays}</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-kpi" style={{ color: "var(--accent)" }}>
              {isLoading ? "–" : monthValue}
            </span>
            <span className="text-body font-semibold text-[color:var(--muted-foreground)]">
              {monthValue === 1 ? dictionary.clients.newOne : dictionary.clients.newMany}
            </span>
          </div>
          {delta !== null && !isLoading ? (
            <span
              className="mt-3 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-micro font-semibold"
              style={delta > 0
                ? { borderColor: "var(--accent)", color: "var(--accent)" }
                : { borderColor: "var(--border)", color: "var(--muted-foreground)" }}
            >
              {delta > 0 ? `↑ +${delta}` : delta < 0 ? `↓ ${delta}` : "– 0"} {dictionary.clients.vsPreviousMonth ?? "vs. mês anterior"}
            </span>
          ) : null}
        </div>
        {series.length > 0 ? <RhythmSparkline series={series} /> : null}
        <div className="flex flex-col gap-2.5 border-t border-[color:var(--border)] pt-4 md:col-span-full md:flex-row md:gap-8 lg:col-span-1 lg:w-60 lg:flex-col lg:gap-2.5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <RhythmPeriodRow label={dictionary.clients.lastSevenDays} value={kpis?.crmNewLast7Days ?? 0} isLoading={isLoading} />
          <RhythmPeriodRow label={dictionary.clients.lastThirtyDays} value={kpis?.crmNewLast30Days ?? 0} isLoading={isLoading} />
          <RhythmPeriodRow label={dictionary.clients.lastTwelveMonths} value={kpis?.crmNewLastYear ?? 0} isLoading={isLoading} />
        </div>
      </div>
    </Card>
  );
}

function AddContactCard() {
  const dictionary = useDashboardDictionary();
  return (
    <Link
      href="/crm?create=contact"
      className="flex min-h-[8rem] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[color:var(--border)] p-4 text-meta font-semibold text-[color:var(--muted-foreground)] transition-colors hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current sm:w-[280px]"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-current">
        <Plus className="h-4 w-4" strokeWidth={2} />
      </span>
      {dictionary.clients.addNew ?? "Novo contacto"}
    </Link>
  );
}

function ContactCard({ c }: { c: DashboardCrmRecentContact }) {
  const dictionary = useDashboardDictionary();
  const meta = crmStatusMeta(c.status, dictionary);
  return (
    <Card asChild variant="interactive" density="compact">
      <Link href="/crm" className="group relative w-full p-4 sm:w-[280px]">
        <span
          aria-hidden
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--foreground-accent-link)] opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-meta font-bold"
          style={{
            background: "var(--dashboard-client-avatar)",
            color: "var(--role-client-strong)",
          }}
          aria-hidden
        >
          {initialsOf(c.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-semibold text-[color:var(--foreground)]">{c.name}</p>
          <p className="truncate text-meta text-[color:var(--muted-foreground)]">{c.company ?? "—"}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-[color:var(--border)] pt-3 text-meta text-[color:var(--muted-foreground)]">
        <Tag meta={meta} />
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays aria-hidden className="h-3.5 w-3.5 opacity-70" strokeWidth={1.75} />
          <span>{c.createdAt ? (dictionary.clients.addedOn ?? dictionary.clients.lastChange) : dictionary.clients.lastChange}</span>
          <span className={`${MONO} font-semibold text-[color:var(--foreground)]`}>
            {formatShortDate(c.createdAt ?? c.lastChangedAt)}
          </span>
        </span>
      </div>
      </Link>
    </Card>
  );
}

function ClientsView({ crm, isLoading }: { crm: DashboardCrmData | null; isLoading: boolean }) {
  const dictionary = useDashboardDictionary();
  const contacts = crm?.crm.recentContacts ?? [];
  const tilesLoading = isLoading && !crm;

  return (
    <div className="space-y-6">
      <PortalSectionHeading
        title={dictionary.clients.title}
        subtitle={dictionary.clients.subtitle}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <PortalActionLink href="/crm">
              {dictionary.clients.viewAll}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </PortalActionLink>
            <Link
              href="/crm?create=contact"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[color:var(--surface-button-brand)] px-3.5 py-1.5 text-meta font-semibold text-[color:var(--accent-foreground)] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current [&_svg]:h-3.5 [&_svg]:w-3.5"
            >
              <Plus />
              {dictionary.clients.addNew ?? "Novo contacto"}
            </Link>
          </div>
        }
      />

      <RhythmCard crm={crm} isLoading={tilesLoading} />

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h3 className={CARD_TITLE}>{dictionary.clients.recentTitle}</h3>
          <span className="text-meta text-[color:var(--muted-foreground)]">
            <span className="text-data font-semibold">{contacts.length}</span>{" "}
            {contacts.length === 1 ? dictionary.clients.one : dictionary.clients.many}
          </span>
        </div>
        {isLoading && contacts.length === 0 ? (
          <div className="flex flex-wrap gap-4">
            {[0, 1, 2, 3].map((i) => (
              <Card
              key={i}
              density="compact"
              className="h-32 w-full justify-between p-4 sm:w-[280px]"
            >
              <div className="flex items-center gap-3">
                <Skeleton rounded="50%" className="h-9 w-9 shrink-0" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton rounded="999px" className="h-[0.6rem] w-[60%]" />
                  <Skeleton rounded="999px" className="h-[0.5rem] w-[80%]" />
                </div>
              </div>
              <Skeleton rounded="999px" className="h-[0.5rem] w-[45%]" />
            </Card>
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <div className="space-y-3">
            <p className="text-body text-[color:var(--muted-foreground)]">{dictionary.clients.noRecent}</p>
            <AddContactCard />
          </div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {contacts.map((c) => (
              <ContactCard key={c.id} c={c} />
            ))}
            <AddContactCard />
          </div>
        )}
      </section>
    </div>
  );
}

/* ─── Actions tab ────────────────────────────────────────────────── */

function TasksView({
  rows,
  tasks,
  isLoading,
  isLoadingMore,
  onLoadMore,
}: {
  rows: TaskRow[];
  tasks: DashboardTasksData | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}) {
  const dictionary = useDashboardDictionary();
  const total = tasks?.kpis.total ?? rows.length;
  return (
    <div className="space-y-4">
      <PortalSectionHeading
        title={dictionary.tasks.title}
        subtitle={`${total} ${total === 1 ? dictionary.tasks.one : dictionary.tasks.many} · ${dictionary.tasks.groupedByUrgencyLower}`}
      />
      <TasksTable
        rows={rows}
        title={dictionary.tasks.all}
        isLoading={isLoading}
        total={tasks?.kpis.total}
        hasMore={tasks?.pagination.hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={onLoadMore}
      />
    </div>
  );
}

function useAttentionPreviewCapacity(cardRef: RefObject<HTMLDivElement | null>) {
  const [capacity, setCapacity] = useState(3);
  useEffect(() => {
    const update = () => {
      const cardTop = cardRef.current?.getBoundingClientRect().top ?? 0;
      setCapacity(getAttentionPreviewCapacity(window.innerWidth, window.innerHeight, cardTop));
    };
    update();
    const observer = new ResizeObserver(update);
    if (cardRef.current) observer.observe(cardRef.current);
    window.addEventListener("resize", update, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [cardRef]);
  return capacity;
}

export function getAttentionPreviewCapacity(viewportWidth: number, viewportHeight: number, cardTop = 0) {
  if (viewportWidth < 640) return 3;
  const availableHeight = viewportHeight - Math.max(0, cardTop) - 24;
  const wholeRows = Math.floor((availableHeight - 130) / 72);
  return Math.max(3, Math.min(6, wholeRows));
}

function AttentionTasksCard({
  tasks,
  isLoading,
  onViewAll,
}: {
  tasks: DashboardTasksData | null;
  isLoading: boolean;
  onViewAll: () => void;
}) {
  const dictionary = useDashboardDictionary();
  const projectBaseHref = useProjectBaseHref();
  const cardRef = useRef<HTMLDivElement>(null);
  const capacity = useAttentionPreviewCapacity(cardRef);
  const attentionTasks = tasks?.attention.tasks ?? [];
  const visibleTasks = attentionTasks.slice(0, capacity);
  const hiddenCount = Math.max(0, (tasks?.attention.total ?? 0) - visibleTasks.length);
  const labels: Record<DashboardTaskAttentionState, string> = {
    blocked: dictionary.tasks.blocked,
    overdue: dictionary.tasks.overdue,
    today: dictionary.tasks.dueToday,
    soon: dictionary.tasks.dueThisWeek,
  };

  return (
    <Card ref={cardRef} className="min-h-0 overflow-hidden lg:col-span-2 lg:col-start-1 lg:row-start-2">
      <header className="flex min-h-[4.875rem] shrink-0 items-center justify-between border-b border-[color:var(--border)] px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="project-section-icon"><CircleDot className="size-3.5" /></span>
          <div>
            <h2 className={CARD_TITLE}>{dictionary.tasks.title}</h2>
            <p className="text-meta text-[color:var(--muted-foreground)]">{dictionary.tasks.attentionSubtitle}</p>
          </div>
        </div>
        {isLoading && !tasks ? <Skeleton className="h-[26px] w-20 rounded-full" /> : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--accent)]/30 bg-[color:var(--accent)]/10 px-2.5 py-1 text-label font-bold text-[color:var(--accent)]">
            <span className="text-data">{tasks?.kpis.total ?? 0}</span> {dictionary.tasks.active}
          </span>
        )}
      </header>

      {isLoading && !tasks ? (
        <div>{Array.from({ length: capacity }, (_, index) => <Skeleton key={index} className="mx-5 my-3 h-12" />)}</div>
      ) : visibleTasks.length === 0 ? (
        <div className="flex min-h-52 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--muted)] text-[color:var(--muted-foreground)]"><CheckCircle2 className="h-5 w-5" /></span>
          <div><p className="text-body font-semibold text-[color:var(--foreground)]">{dictionary.tasks.allClear}</p><p className="mt-0.5 text-meta text-[color:var(--muted-foreground)]">{dictionary.tasks.urgentEmpty}</p></div>
        </div>
      ) : (
        <div>
          {visibleTasks.map((task) => {
            const attentionState = attentionStateFromTask(task, tasks!.generatedAt);
            return <DashboardTaskListRow key={task.id} task={task} href={projectHref(projectBaseHref, task.projectId)} attentionState={attentionState ?? undefined} attentionLabel={attentionState ? labels[attentionState] : undefined} />;
          })}
        </div>
      )}

      <footer className="mt-auto flex min-h-[3.25rem] shrink-0 items-center justify-between gap-3 border-t border-[color:var(--border)] px-5 py-3">
        <span className="text-meta text-[color:var(--muted-foreground)]">
          {hiddenCount > 0 ? dictionary.tasks.moreAttention(hiddenCount) : dictionary.tasks.attentionVisible}
        </span>
        <button type="button" onClick={onViewAll} className="text-body shrink-0 font-semibold text-[color:var(--accent)] hover:underline">
          {dictionary.tasks.viewAll} →
        </button>
      </footer>
    </Card>
  );
}

/* ─── Overview ───────────────────────────────────────────────────── */

function OverviewView({
  data,
  milestones,
  sections,
  onViewAllTasks,
}: {
  data: DashboardState;
  milestones: Milestone[];
  sections: DashboardSection[];
  onViewAllTasks: () => void;
}) {
  const overviewMilestones = milestones.slice(0, 5);

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:grid-rows-[auto_minmax(0,1fr)] lg:[grid-auto-flow:dense]">
      {sections.includes("projects") ? <ProjectsKpiCard projects={data.projects} isLoading={data.isProjectsLoading} /> : null}
      {sections.includes("crm") ? <CrmKpiCard crm={data.crm} isLoading={data.isCrmLoading} /> : null}
      {sections.includes("tasks") ? <AttentionTasksCard tasks={data.tasks} isLoading={data.tasks === null && data.isTasksLoading} onViewAll={onViewAllTasks} /> : null}
      {sections.includes("projects") ? <MilestonesPanel
        items={overviewMilestones}
        isLoading={data.isProjectsLoading && milestones.length === 0}
        className="lg:col-start-3 lg:row-start-1 lg:row-span-2 lg:h-full"
      /> : null}
    </section>
  );
}

/* ─── Page ───────────────────────────────────────────────────────── */

export type AppDashboardProps = {
  client: DashboardDataClient;
  contributions: DashboardSurfaceContribution[];
  initialData?: DashboardInitialData;
  viewerFirstName?: string | null;
  dictionary?: DashboardDictionary;
  onNotify?: (message: string) => void;
};

export function AppDashboard({ client, contributions, initialData, viewerFirstName, dictionary = defaultDashboardDictionary, onNotify }: AppDashboardProps) {
  const sections = useMemo(() => Array.from(new Set(contributions.flatMap((contribution) => contribution.sections))), [contributions]);
  const projectComponents = contributions.find((contribution) => contribution.projectComponents)?.projectComponents ?? null;
  const projectBaseHref = projectComponents?.projectBaseHref ?? "/projects";
  const [tab, setTab] = useState<TabKey>("overview");
  const data = useDashboardData({ client, initialData, sections, messages: dictionary.data, onNotify });

  const taskRows = useMemo(() => buildTasks(data.tasks, projectBaseHref), [data.tasks, projectBaseHref]);
  const milestones = useMemo(() => buildMilestones(data.projects), [data.projects]);

  const urgentCount =
    (data.tasks?.kpis.overdue ?? 0) + (data.tasks?.kpis.blocked ?? 0) + (data.projects?.kpis.projectsAttention ?? 0);

  return (
    <DashboardDictionaryContext.Provider value={dictionary}>
    <ProjectComponentsContext.Provider value={projectComponents}>
    <div
      className="dashboard-root min-h-0"
      style={
        {
          ["--muted-foreground" as string]: "var(--dashboard-local-muted-foreground)",
          ["--border" as string]: "var(--dashboard-local-border)",
          ["--muted" as string]: "var(--dashboard-local-muted)",
        } as CSSProperties
      }
    >
      <div className="mx-auto flex w-full max-w-[1480px] flex-col pb-6 pt-0 md:pb-8">
        <WelcomeHeader
          name={viewerFirstName ?? ""}
          urgentCount={urgentCount}
          unownedProjects={data.projects?.kpis.projectsWithoutOwner ?? 0}
          errors={sections.flatMap((section) => data.errors[section] ? [data.errors[section]] : [])}
          activeProjects={data.projects?.kpis.projectsActive ?? 0}
          overdueProjects={data.projects?.kpis.projectsOverdue ?? 0}
          newLeads={data.crm?.kpis.crmNewLast7Days ?? 0}
        />
        <div className="mt-6">
          <TabsRow
            value={tab}
            sections={sections}
            onChange={(nextTab) => {
              setTab(nextTab);
              if (nextTab === "tasks") data.ensureTasks();
            }}
          />
        </div>

        <div className="mt-3">
          {tab === "overview" && (
            <OverviewView data={data} milestones={milestones} sections={sections} onViewAllTasks={() => setTab("tasks")} />
          )}
          {tab === "projects" && sections.includes("projects") ? <ProjectsView projects={data.projects} isLoading={data.isProjectsLoading} /> : null}
          {tab === "clients" && sections.includes("crm") ? <ClientsView crm={data.crm} isLoading={data.isCrmLoading} /> : null}
          {tab === "tasks" && sections.includes("tasks") ? (
            <TasksView
              rows={taskRows}
              tasks={data.tasks}
              isLoading={data.isTasksLoading}
              isLoadingMore={data.isTasksLoadingMore}
              onLoadMore={data.loadMoreTasks}
            />
          ) : null}
        </div>
      </div>
    </div>
    </ProjectComponentsContext.Provider>
    </DashboardDictionaryContext.Provider>
  );
}

export const DashboardClient = AppDashboard;
export default AppDashboard;
