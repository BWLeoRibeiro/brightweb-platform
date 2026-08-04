"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Flag,
} from "lucide-react";

import { Skeleton } from "@brightweblabs/ui";
import type { DashboardAssignedTask, DashboardCrmData, DashboardCrmRecentContact, DashboardDataClient, DashboardInitialData, DashboardProjectComponents, DashboardProjectItem, DashboardProjectsData, DashboardSection, DashboardSurfaceContribution, DashboardTasksData } from "./types";
import { useDashboardData, type DashboardState } from "./use-dashboard-data";
import { defaultDashboardDictionary, type DashboardDictionary } from "./dictionary";
import { DashboardActionLink as PortalActionLink, DashboardSectionHeading as PortalSectionHeading, dashboardCardTitleClassName as CARD_TITLE, dashboardLabelClassName as LABEL, dashboardMonoTabularClassName as MONO } from "./primitives";
import { cn } from "../lib/utils";
import { PillTabs } from "../components/pill-tabs";


const ProjectComponentsContext = createContext<DashboardProjectComponents | null>(null);
const DashboardDictionaryContext = createContext<DashboardDictionary>(defaultDashboardDictionary);
function useProjectComponents() { return useContext(ProjectComponentsContext); }
function useDashboardDictionary() { return useContext(DashboardDictionaryContext); }
function ProjectSummaryCard({ project }: { project: DashboardProjectItem }) { const value = useProjectComponents(); return value ? <value.ProjectSummaryCard project={project} /> : null; }
function ProjectSummaryCardSkeleton() { const value = useProjectComponents(); return value ? <value.ProjectSummaryCardSkeleton /> : null; }
function TaskDueMeta(props: { dueDate: string | null; isOverdue?: boolean; className?: string }) { const value = useProjectComponents(); return value ? <value.TaskDueMeta {...props} /> : null; }
function TaskPriorityTag({ task }: { task: Pick<DashboardAssignedTask, "status" | "priority"> }) { const value = useProjectComponents(); return value ? <value.TaskPriorityTag task={task} /> : null; }
function TaskStatusTag({ task }: { task: Pick<DashboardAssignedTask, "status" | "blockedReason"> }) { const value = useProjectComponents(); return value ? <value.TaskStatusTag task={task} /> : null; }

/* ──────────────────────────────────────────────────────────────────
   V6 — real data. Welcome → hero 4-card grid →
   activity table (grouped) + milestones. Projects/Clients/Actions
   tabs render from live endpoints. Hours stays mocked.
   ────────────────────────────────────────────────────────────────── */

// TODO(dashboard-hours): wire real data source

type TabKey = "overview" | "projects" | "clients" | "tasks";

/* ─── Shared tokens ──────────────────────────────────────────────── */

const SURFACE = "dashboard-surface";

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
  const dow = new Intl.DateTimeFormat("pt-PT", { weekday: "long" }).format(d);
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
  return new Intl.DateTimeFormat("pt-PT", { weekday: "short" }).format(d).replace(".", "").toUpperCase();
}

function initialsOf(name: string | null | undefined, fallback = "?") {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function codeOf(p: Pick<DashboardProjectItem, "id" | "code">) {
  return p.code ?? p.id.slice(0, 8).toUpperCase();
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

/* ─── Welcome + Tabs ─────────────────────────────────────────────── */

function WelcomeHeader({
  name,
  urgentCount,
  errors,
  activeProjects,
  overdueProjects,
  newLeads,
}: {
  name: string;
  urgentCount: number;
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

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const interval = window.setInterval(update, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <header className="dashboard-briefing">
      <div className="dashboard-briefing-copy">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-meta font-semibold text-[color:var(--muted-foreground)]">
            <CalendarDays className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
            <span className="text-data capitalize">{dateLabel}</span>
            <span className="opacity-40">·</span>
            <span className="text-data">{time}</span>
          </p>

          <h1 className="font-display mt-3 text-heading-1 font-extrabold tracking-[var(--type-tracking-n035)] text-[color:var(--foreground)]">
            {greeting}
            {name ? (
              <>
                , <span className="text-[color:var(--accent)]">{name}</span>
              </>
            ) : (
              ""
            )}
            .
          </h1>

          <p className="mt-2 max-w-[36rem] text-body text-[color:var(--muted-foreground)]">
            {urgentCount > 0 ? (
              <>
                <span className="font-semibold text-[color:var(--foreground)]">
                  {urgentCount} {urgentCount === 1 ? dictionary.welcome.urgentOne : dictionary.welcome.urgentMany}
                </span>{" "}
                {dictionary.welcome.attentionToday}
              </>
            ) : (
              dictionary.welcome.allClear
            )}
          </p>

        </div>
        <div className="dashboard-briefing-metrics" aria-label="Resumo de hoje">
          <div className="dashboard-briefing-metric dashboard-briefing-metric-attention">
            <strong className="text-data">{urgentCount}</strong>
            <span>{urgentCount === 1 ? dictionary.welcome.urgentOne : dictionary.welcome.urgentMany}</span>
          </div>
          <div className="dashboard-briefing-metric">
            <strong className="text-data">{activeProjects}</strong>
            <span>{dictionary.welcome.activeProjects}</span>
          </div>
          <div className="dashboard-briefing-metric">
            <strong className="text-data">{overdueProjects}</strong>
            <span>{dictionary.welcome.overdueProjects}</span>
          </div>
          <div className="dashboard-briefing-metric">
            <strong className="text-data">{newLeads}</strong>
            <span>{dictionary.welcome.newLeads}</span>
          </div>
        </div>
      </div>
      {errors.length > 0 ? (
        <div className="dashboard-briefing-errors" role="status">
          {errors.map((error) => (
            <span key={error} className="dashboard-error inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-meta font-semibold leading-snug">
              <AlertTriangle className="h-3 w-3" />
              {error}
            </span>
          ))}
        </div>
      ) : null}
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

/* ─── Activity table ─────────────────────────────────────────────── */

type TaskRow = {
  id: string;
  code: string;
  name: string;
  group: "due" | "risk" | "flight";
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
  risk: {
    header:
      "bg-[color:var(--dashboard-task-risk-bg)] hover:bg-[color:var(--dashboard-task-risk-hover)]",
    label: "text-[color:var(--project-risk-overdue-strong)]",
    dot: "bg-[color:var(--project-risk-overdue)]",
  },
  due: {
    header:
      "bg-[color:var(--dashboard-task-due-bg)] hover:bg-[color:var(--dashboard-task-due-hover)]",
    label: "text-[color:var(--project-risk-at-risk-strong)]",
    dot: "bg-[color:var(--project-risk-at-risk)]",
  },
  flight: {
    header:
      "bg-[color:var(--dashboard-task-flight-bg)] hover:bg-[color:var(--dashboard-task-flight-hover)]",
    label: "text-[color:var(--muted-foreground)]",
    dot: "bg-foreground/30",
  },
};

// Explicit label styling (11px/600/uppercase) so the per-group tone color wins
// over the shared muted text-label text-muted-foreground color.
const TASK_GROUP_LABEL_BASE = "text-label font-semibold uppercase tracking-[var(--type-tracking-060)]";

function groupFromTask(task: DashboardAssignedTask): TaskRow["group"] {
  if (task.status === "blocked") return "risk";
  if (!task.dueDate) return "flight";
  const t = new Date(task.dueDate).getTime();
  if (Number.isNaN(t)) return "flight";
  const now = Date.now();
  if (t < now) return "risk";
  if (t <= now + 7 * 24 * 60 * 60 * 1000) return "due";
  return "flight";
}

function buildTasks(tasks: DashboardTasksData | null): TaskRow[] {
  if (!tasks) return [];
  return tasks.tasks.map((task) => ({
    id: `task-${task.id}`,
    code: task.projectCode ?? task.projectName.slice(0, 12).toUpperCase(),
    name: task.title,
    group: groupFromTask(task),
    status: task.status,
    priority: task.priority,
    blockedReason: task.blockedReason,
    dueDate: task.dueDate,
    href: `/projects/${task.projectId}`,
  }));
}

function TasksTable({
  rows,
  title,
  isLoading,
  className = "",
  bodyClassName = "",
}: {
  rows: TaskRow[];
  title?: string;
  isLoading: boolean;
  className?: string;
  bodyClassName?: string;
}) {
  const dictionary = useDashboardDictionary();
  const groups: TaskRow["group"][] = ["risk", "due", "flight"];
  const groupLabel: Record<TaskRow["group"], string> = {
    risk: dictionary.tasks.overdue,
    due: dictionary.tasks.dueThisWeek,
    flight: dictionary.tasks.inProgress,
  };

  return (
    <div className={`${SURFACE} flex min-h-0 flex-col overflow-hidden ${className}`}>
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
            <span className="text-data">{rows.length}</span> {dictionary.tasks.active}
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
                  <Link
                    key={r.id}
                    href={r.href}
                    prefetch={false}
                    className="group relative flex w-full flex-col gap-1 border-t border-[color:var(--border)] px-5 py-2.5 text-left transition first:border-t-0 hover:bg-[color:var(--dashboard-task-row-hover)]"
                  >
                    {/* Primary: title + due date */}
                    <div className="flex min-w-0 items-start gap-2">
                      <p className="text-body text-foreground min-w-0 flex-1 font-semibold leading-snug line-clamp-2" title={r.name}>
                        {r.name}
                      </p>
                      <TaskDueMeta
                        dueDate={r.dueDate}
                        isOverdue={r.group === "risk"}
                        className="whitespace-nowrap pt-0.5"
                      />
                    </div>

                    {/* Secondary: signal tags */}
                    <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5">
                      <TaskPriorityTag task={{ priority: r.priority, status: r.status }} />
                      <TaskStatusTag task={{ status: r.status, blockedReason: r.blockedReason }} />
                      <span
                        className={`${MONO} ml-auto max-w-[8rem] truncate text-label text-[color:var(--muted-foreground)]`}
                        title={r.code}
                      >
                        {r.code}
                      </span>
                    </div>
                  </Link>
                ))}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ─── Milestones panel ───────────────────────────────────────────── */

type Milestone = {
  projectId: string;
  day: string;
  date: string;
  title: string;
  code: string;
  highlight?: boolean;
};

function buildMilestones(projects: DashboardProjectsData | null): Milestone[] {
  if (!projects) return [];
  const rows: Milestone[] = [];
  for (const p of projects.projects.overdue) {
    if (!p.targetDate) continue;
    const d = new Date(p.targetDate);
    if (Number.isNaN(d.getTime())) continue;
    rows.push({
      projectId: p.id,
      day: formatWeekday(p.targetDate),
      date: String(d.getDate()).padStart(2, "0"),
      title: p.name,
      code: codeOf(p),
      highlight: isDueThisWeek(p.targetDate),
    });
  }
  return rows.slice(0, 6);
}

function MilestonesPanel({ items, isLoading = false, className = "" }: { items: Milestone[]; isLoading?: boolean; className?: string }) {
  const dictionary = useDashboardDictionary();
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
          className="rounded-full border px-2 py-0.5 text-micro font-bold tracking-widest"
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
            <li key={`${m.projectId}-${m.date}`}>
              <Link
                href={`/projects/${m.projectId}`}
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
                  <span className="block text-micro text-[length:var(--text-ui-nano-lg)] font-bold leading-none tracking-[var(--type-tracking-080)] opacity-80">
                    {m.day}
                  </span>
                  <span className={`${MONO} block text-heading-4 font-extrabold leading-none`}>
                    {m.date}
                  </span>
                </div>
                <div className="relative min-w-0 flex-1">
                  <p className="truncate text-body text-[length:var(--text-ui-action)] font-semibold">{m.title}</p>
                  <p className={`${MONO} truncate text-label`} style={{ color: "var(--project-hero-muted)" }}>
                    {m.code}
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

function ProjectsView({ projects, isLoading }: { projects: DashboardProjectsData | null; isLoading: boolean }) {
  const dictionary = useDashboardDictionary();
  const kpis = projects?.kpis;
  const list = projects?.projects.overdue ?? [];

  return (
    <div className="space-y-6">
      <PortalSectionHeading
        title={dictionary.projects.attentionTitle}
        subtitle={
          <>
            <span className={`${MONO} font-semibold text-[color:var(--project-risk-overdue-strong)]`}>
              {kpis?.projectsOverdue ?? 0}
            </span>{" "}
            {dictionary.projects.overdue}
            <span className="mx-1.5 opacity-50">·</span>
            <span className={`${MONO} font-semibold text-[color:var(--project-risk-at-risk-strong)]`}>
              {kpis?.projectsAtRisk ?? 0}
            </span>{" "}
            {dictionary.projects.atRisk}
            <span className="mx-1.5 opacity-50">·</span>
            <span className={`${MONO} font-semibold text-[color:var(--accent)]`}>
              {kpis?.projectsDueNext7Days ?? 0}
            </span>{" "}
            {dictionary.projects.dueInSevenDays}
          </>
        }
        action={
          <PortalActionLink href="/projects" prefetch={false}>
            {dictionary.projects.viewAll}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </PortalActionLink>
        }
      />

      {isLoading && list.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <ProjectSummaryCardSkeleton key={i} />
          ))}
        </div>
      ) : list.length === 0 ? (
        <p className="text-body text-[color:var(--muted-foreground)]">{dictionary.projects.noneNeedAttention(kpis?.projectsActive ?? 0)}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {list.map((project) => (
            <ProjectSummaryCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Clients tab ────────────────────────────────────────────────── */

type TagMeta = { label: string; color: string; strong: string };

function Tag({ meta }: { meta: TagMeta }) {
  return (
    <span
      className="tint-soft inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-micro font-bold uppercase tracking-[var(--type-tracking-080)]"
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

function PeriodTile({
  label,
  value,
  isLoading,
  accent,
}: {
  label: string;
  value: number;
  isLoading: boolean;
  accent?: boolean;
}) {
  const dictionary = useDashboardDictionary();
  return (
    <div className={`relative overflow-hidden ${SURFACE} flex flex-col p-6`}>
      {accent && (
        <span
          aria-hidden
          className="absolute right-0 top-0 h-20 w-20 rounded-full blur-2xl"
          style={{ background: "var(--dashboard-period-glow)" }}
        />
      )}
      <span className={LABEL}>{label}</span>
      <div className="relative mt-4 flex items-baseline gap-2">
        <span
          className="text-kpi text-foreground"
          style={accent ? { color: "var(--accent)" } : undefined}
        >
          {isLoading ? "–" : value}
        </span>
        <span className="text-body font-semibold text-[color:var(--muted-foreground)]">
          {value === 1 ? dictionary.clients.newOne : dictionary.clients.newMany}
        </span>
      </div>
    </div>
  );
}

function ContactCard({ c }: { c: DashboardCrmRecentContact }) {
  const dictionary = useDashboardDictionary();
  const meta = crmStatusMeta(c.status, dictionary);
  return (
    <Link
      href="/crm"
      className={`${SURFACE} group flex w-full flex-col p-4 transition hover:border-[color:var(--accent)]/40 hover:shadow-[var(--dashboard-shadow-md)] sm:w-[280px]`}
    >
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
          <CalendarDays className="h-3.5 w-3.5 opacity-70" strokeWidth={1.75} />
          <span>{dictionary.clients.lastChange}</span>
          <span className={`${MONO} font-semibold text-[color:var(--foreground)]`}>
            {formatShortDate(c.lastChangedAt)}
          </span>
        </span>
      </div>
    </Link>
  );
}

function ClientsView({ crm, isLoading }: { crm: DashboardCrmData | null; isLoading: boolean }) {
  const dictionary = useDashboardDictionary();
  const kpis = crm?.kpis;
  const contacts = crm?.crm.recentContacts ?? [];
  const tilesLoading = isLoading && !crm;

  return (
    <div className="space-y-6">
      <PortalSectionHeading
        title={dictionary.clients.title}
        subtitle={dictionary.clients.subtitle}
        action={
          <PortalActionLink href="/crm">
            {dictionary.clients.viewAll}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </PortalActionLink>
        }
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <PeriodTile
          label={dictionary.clients.lastSevenDays}
          value={kpis?.crmNewLast7Days ?? 0}
          isLoading={tilesLoading}
          accent
        />
        <PeriodTile
          label={dictionary.clients.lastThirtyDays}
          value={kpis?.crmNewLast30Days ?? 0}
          isLoading={tilesLoading}
        />
        <PeriodTile
          label={dictionary.clients.lastTwelveMonths}
          value={kpis?.crmNewLastYear ?? 0}
          isLoading={tilesLoading}
        />
      </section>

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
              <div
              key={i}
              className={`${SURFACE} flex h-32 w-full flex-col justify-between p-4 sm:w-[280px]`}
            >
              <div className="flex items-center gap-3">
                <Skeleton rounded="50%" className="h-9 w-9 shrink-0" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton rounded="999px" className="h-[0.6rem] w-[60%]" />
                  <Skeleton rounded="999px" className="h-[0.5rem] w-[80%]" />
                </div>
              </div>
              <Skeleton rounded="999px" className="h-[0.5rem] w-[45%]" />
            </div>
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <p className="text-body text-[color:var(--muted-foreground)]">{dictionary.clients.noRecent}</p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {contacts.map((c) => (
              <ContactCard key={c.id} c={c} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ─── Actions tab ────────────────────────────────────────────────── */

function TasksView({ rows, isLoading }: { rows: TaskRow[]; isLoading: boolean }) {
  const dictionary = useDashboardDictionary();
  return (
    <div className="space-y-4">
      <PortalSectionHeading
        title={dictionary.tasks.title}
        subtitle={`${rows.length} ${rows.length === 1 ? dictionary.tasks.one : dictionary.tasks.many} · ${dictionary.tasks.groupedByUrgencyLower}`}
      />
      <TasksTable rows={rows} title={dictionary.tasks.all} isLoading={isLoading} />
    </div>
  );
}

/* ─── Overview ───────────────────────────────────────────────────── */

function AttentionPanel({ projects, isLoading }: { projects: DashboardProjectsData | null; isLoading: boolean }) {
  const dictionary = useDashboardDictionary();
  const items = projects?.projects.overdue.slice(0, 4) ?? [];
  const attentionCount = projects?.kpis.projectsOverdue ?? 0;

  return (
    <section className={`${SURFACE} flex min-h-0 flex-col overflow-hidden`}>
      <header className="flex items-center justify-between border-b border-[color:var(--border)] px-5 py-4">
        <div>
          <p className={LABEL}>{dictionary.header.kicker}</p>
          <h2 className={CARD_TITLE}>{dictionary.projects.attentionTitle}</h2>
        </div>
        <span className={cn(
          "text-data rounded-full px-2.5 py-1 text-meta font-bold",
          attentionCount > 0
            ? "bg-[color:var(--dashboard-danger-soft)] text-[color:var(--dashboard-danger-foreground)]"
            : "bg-[color:var(--muted)] text-[color:var(--project-state-active)]",
        )}>
          {attentionCount}
        </span>
      </header>
      {isLoading && items.length === 0 ? (
        <div className="space-y-3 p-5" aria-hidden="true">
          {[0, 1, 2].map((item) => <Skeleton key={item} className="h-14 rounded-lg" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--muted)] text-[color:var(--project-state-active)]">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <p className="max-w-[18rem] text-body text-[color:var(--muted-foreground)]">
            {dictionary.projects.noneNeedAttention(projects?.kpis.projectsActive ?? 0)}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[color:var(--border)]">
          {items.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`} prefetch={false} className="group flex items-center gap-3 px-5 py-3 transition hover:bg-[color:var(--dashboard-task-row-hover)]">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{
                  background: TONE_COLOR[
                    project.taskStats.overdue > 0
                      ? "risk"
                      : project.taskStats.blocked > 0 || project.health === "at_risk"
                        ? "watch"
                        : healthToTone(project.health)
                  ],
                }}
              />
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-body font-semibold text-[color:var(--foreground)]">{project.name}</strong>
                <small className="block truncate text-meta text-[color:var(--muted-foreground)]">{project.organizationName} · {formatShortDate(project.targetDate)}</small>
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 text-[color:var(--muted-foreground)] opacity-0 transition group-hover:opacity-100" />
            </Link>
          ))}
        </div>
      )}
      <PortalActionLink href="/projects" prefetch={false} className="m-4 mt-auto self-start">
        {dictionary.projects.viewAll}<ArrowUpRight className="h-3.5 w-3.5" />
      </PortalActionLink>
    </section>
  );
}

function RecentChangesPanel({ crm, isLoading }: { crm: DashboardCrmData | null; isLoading: boolean }) {
  const dictionary = useDashboardDictionary();
  const changes = crm?.crm.recentChanges.slice(0, 4) ?? [];

  return (
    <section className={`${SURFACE} overflow-hidden`}>
      <header className="flex items-center justify-between border-b border-[color:var(--border)] px-5 py-4">
        <div>
          <p className={LABEL}>{dictionary.crm.title}</p>
          <h2 className={CARD_TITLE}>{dictionary.clients.lastChange}</h2>
        </div>
        <PortalActionLink href="/crm">{dictionary.clients.viewAll}<ArrowUpRight className="h-3.5 w-3.5" /></PortalActionLink>
      </header>
      {isLoading && changes.length === 0 ? (
        <div className="grid gap-3 p-5 sm:grid-cols-2" aria-hidden="true">
          {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-16 rounded-lg" />)}
        </div>
      ) : changes.length === 0 ? (
        <div className="px-5 py-8 text-center text-body text-[color:var(--muted-foreground)]">{dictionary.clients.noRecent}</div>
      ) : (
        <div className="grid sm:grid-cols-2">
          {changes.map((change) => (
            <Link key={change.id} href="/crm" className="group flex items-center gap-3 border-b border-[color:var(--border)] px-5 py-3 odd:sm:border-r">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--muted)] text-meta font-bold text-[color:var(--foreground)]">
                {initialsOf(change.contactLabel)}
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-body font-semibold text-[color:var(--foreground)]">{change.contactLabel}</strong>
                <small className="flex items-center gap-1.5 text-meta text-[color:var(--muted-foreground)]">
                  {change.previousStatus ? crmStatusMeta(change.previousStatus, dictionary).label : "—"}
                  <span aria-hidden="true">→</span>
                  <span className="font-semibold text-[color:var(--foreground)]">{change.newStatus ? crmStatusMeta(change.newStatus, dictionary).label : "—"}</span>
                </small>
              </span>
              <span className="text-data text-label text-[color:var(--muted-foreground)]">{formatShortDate(change.changedAt)}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function OverviewView({
  data,
  taskRows,
  milestones,
  sections,
}: {
  data: DashboardState;
  taskRows: TaskRow[];
  milestones: Milestone[];
  sections: DashboardSection[];
}) {
  const overviewTaskRows = taskRows.slice(0, 5);
  const overviewMilestones = milestones.slice(0, 5);

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {sections.includes("projects") ? (
        <div className="lg:col-span-4">
          <AttentionPanel projects={data.projects} isLoading={data.isProjectsLoading} />
        </div>
      ) : null}
      {sections.includes("tasks") ? <TasksTable
        rows={overviewTaskRows}
        isLoading={data.tasks === null && (data.isProjectsLoading || data.isCrmLoading || data.isTasksLoading)}
        className="h-[360px] lg:col-span-8"
        bodyClassName="flex-1 overflow-hidden"
      /> : null}
      {sections.includes("crm") ? (
        <div className="lg:col-span-8">
          <RecentChangesPanel crm={data.crm} isLoading={data.isCrmLoading} />
        </div>
      ) : null}
      {sections.includes("projects") ? (
        <MilestonesPanel
          items={overviewMilestones}
          isLoading={data.isProjectsLoading && milestones.length === 0}
          className="min-h-[260px] lg:col-span-4"
        />
      ) : null}
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
  const [tab, setTab] = useState<TabKey>("overview");
  const data = useDashboardData({ client, initialData, sections, messages: dictionary.data, onNotify });

  const taskRows = useMemo(() => buildTasks(data.tasks), [data.tasks]);
  const milestones = useMemo(() => buildMilestones(data.projects), [data.projects]);

  const urgentCount =
    (data.tasks?.kpis.overdue ?? 0) + (data.tasks?.kpis.blocked ?? 0) + (data.projects?.kpis.projectsAtRisk ?? 0);

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
            <OverviewView data={data} taskRows={taskRows} milestones={milestones} sections={sections} />
          )}
          {tab === "projects" && sections.includes("projects") ? <ProjectsView projects={data.projects} isLoading={data.isProjectsLoading} /> : null}
          {tab === "clients" && sections.includes("crm") ? <ClientsView crm={data.crm} isLoading={data.isCrmLoading} /> : null}
          {tab === "tasks" && sections.includes("tasks") ? <TasksView rows={taskRows} isLoading={data.isTasksLoading} /> : null}
        </div>
      </div>
    </div>
    </ProjectComponentsContext.Provider>
    </DashboardDictionaryContext.Provider>
  );
}

export const DashboardClient = AppDashboard;
export default AppDashboard;
