"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { ArrowUpRight, CheckCircle2, CircleDot } from "lucide-react";
import { Card, Skeleton } from "@brightweblabs/ui";
import type { DashboardAssignedTask, DashboardTaskAttentionState, DashboardTasksData } from "./types";
import { DashboardActionLink as PortalActionLink, DashboardCountPill, DashboardEmptyState, DashboardSectionHeading as PortalSectionHeading, QuickCreateAction, dashboardCardTitleClassName as CARD_TITLE, dashboardMonoTabularClassName as MONO } from "./primitives";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@brightweblabs/ui";
import { cn } from "../lib/utils";
import { buildDashboardProjectHref, useDashboardDictionary, DashboardTaskListRow, useTasksBaseHref, useProjectBaseHref } from "./dashboard-context";
import { RhythmPeriodRow } from "./dashboard-kpis";

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

export function buildTasks(tasks: DashboardTasksData | null, projectBaseHref: string): TaskRow[] {
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
    href: buildDashboardProjectHref(projectBaseHref, task.projectId),
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
  createHref,
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
  createHref: string;
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
          <DashboardCountPill count={total ?? rows.length} label={dictionary.tasks.active} tone="accent" />
        )}
      </header>

      <div className={`min-h-0 flex-1 ${bodyClassName}`}>
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
          <DashboardEmptyState
            icon={(
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--muted)] text-[color:var(--muted-foreground)]">
                <CheckCircle2 aria-hidden className="h-5 w-5" />
              </span>
            )}
            title={dictionary.tasks.allClear}
            description={dictionary.tasks.createEmptyDescription}
          >
            <TaskQuickCreateAction href={createHref} label={dictionary.tasks.addNew} />
          </DashboardEmptyState>
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
            disabled={isLoading || isLoadingMore}
            className="text-body rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 font-semibold text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] disabled:cursor-wait disabled:opacity-60"
          >
            {isLoadingMore ? dictionary.tasks.loadingMore : dictionary.tasks.loadMore}
          </button>
        </div>
      ) : null}
    </Card>
  );
}

export function buildTaskQuickCreateHref(baseHref: string) {
  const url = new URL(baseHref, "http://dashboard.local");
  url.searchParams.set("create", "task");
  return `${url.pathname}${url.search}${url.hash}`;
}

function TaskQuickCreateAction({ href, label }: { href: string; label: string }) {
  return <QuickCreateAction href={buildTaskQuickCreateHref(href)} label={label} />;
}

type UpcomingTaskDay = {
  dateKey: string;
  weekday: string;
  fullDate: string;
  isToday: boolean;
  count: number;
  tasks: DashboardAssignedTask[];
};

function uniquePulseTasks(tasks: DashboardTasksData | null) {
  const byId = new Map<string, DashboardAssignedTask>();
  for (const task of tasks?.attention.tasks ?? []) byId.set(task.id, task);
  for (const task of tasks?.tasks ?? []) byId.set(task.id, task);
  return Array.from(byId.values());
}

export function buildUpcomingTaskDays(
  tasks: DashboardAssignedTask[],
  generatedAt = new Date().toISOString(),
): UpcomingTaskDay[] {
  const tasksByDate = new Map<string, DashboardAssignedTask[]>();
  for (const task of tasks) {
    const dateKey = task.dueDate ? /^\d{4}-\d{2}-\d{2}/.exec(task.dueDate)?.[0] : null;
    if (!dateKey) continue;
    const items = tasksByDate.get(dateKey);
    if (items) items.push(task);
    else tasksByDate.set(dateKey, [task]);
  }

  const startKey = dateOnly(generatedAt) ?? dateOnly(new Date())!;
  const start = new Date(`${startKey}T00:00:00.000Z`);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const dateKey = date.toISOString().slice(0, 10);
    const dueTasks = tasksByDate.get(dateKey) ?? [];
    const formattedDate = new Intl.DateTimeFormat("pt-PT", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(date);
    return {
      dateKey,
      weekday: new Intl.DateTimeFormat("pt-PT", { weekday: "short", timeZone: "UTC" }).format(date).replace(".", "").slice(0, 3),
      fullDate: formattedDate.charAt(0).toLocaleUpperCase("pt-PT") + formattedDate.slice(1),
      isToday: index === 0,
      count: dueTasks.length,
      tasks: dueTasks,
    };
  });
}

function TasksPulseLegendRow({ label, value, color }: { label: string; value: number; color: string }) {
  const isEmpty = value === 0;
  return (
    <div className="flex items-center justify-between gap-4 text-label">
      <span className={cn("inline-flex min-w-0 items-center gap-2", isEmpty ? "text-[color:var(--project-hero-subtle)]" : "text-[color:var(--project-hero-muted)]")}>
        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
        <span className="truncate">{label}</span>
      </span>
      <strong className={cn("text-data-sm", isEmpty ? "text-[color:var(--project-hero-subtle)]" : "text-[color:var(--project-hero-foreground)]")}>{value}</strong>
    </div>
  );
}

function TasksPulseCard({ tasks, isLoading }: { tasks: DashboardTasksData | null; isLoading: boolean }) {
  const dictionary = useDashboardDictionary();
  const kpis = tasks?.kpis;
  const pulseTasks = uniquePulseTasks(tasks);
  const todayKey = tasks ? dateOnly(tasks.generatedAt) : null;
  const visibleDueToday = todayKey
    ? pulseTasks.filter((task) => task.status !== "blocked" && task.dueDate && dateOnly(task.dueDate) === todayKey).length
    : 0;
  const blocked = kpis?.blocked ?? 0;
  const overdue = kpis?.overdue ?? 0;
  const dueThisWeek = kpis?.dueThisWeek ?? 0;
  const dueToday = Math.min(visibleDueToday, dueThisWeek);
  const thisWeekAfterToday = Math.max(0, dueThisWeek - dueToday);
  const later = Math.max(0, (kpis?.total ?? 0) - blocked - overdue - dueThisWeek);
  const needsAction = blocked + overdue + dueToday;
  const upcomingDays = buildUpcomingTaskDays(pulseTasks, tasks?.generatedAt);
  const upcomingTotal = upcomingDays.reduce((sum, day) => sum + day.count, 0);
  const composition = [
    { label: dictionary.tasks.blocked, value: blocked, color: "var(--project-risk-at-risk)" },
    { label: dictionary.tasks.overdue, value: overdue, color: "var(--project-risk-overdue)" },
    { label: dictionary.tasks.dueToday, value: dueToday, color: "var(--accent)" },
    { label: dictionary.tasks.dueThisWeek, value: thisWeekAfterToday, color: "var(--brand-lime,var(--project-state-active))" },
    { label: dictionary.tasks.later, value: later, color: "var(--project-hero-subtle)" },
  ];
  const compositionAriaLabel = composition.map((item) => `${item.label}: ${item.value}`).join("; ");
  const statusLabel = needsAction > 0 ? dictionary.tasks.pulseStatusAttention : dictionary.tasks.pulseStatusClear;

  return (
    <aside
      className="brand-panel dashboard-tasks-pulse overflow-hidden rounded-[var(--radius-card)] p-6 text-[color:var(--project-hero-foreground)]"
      aria-labelledby="dashboard-tasks-pulse-title"
    >
      <span aria-hidden className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-[color:var(--dashboard-milestone-glow)] blur-3xl opacity-100 dark:opacity-40" />
      <div className="relative flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-[1.875rem] w-[1.875rem] shrink-0 items-center justify-center rounded-full bg-[color:var(--dashboard-milestone-icon)] text-[color:var(--accent)]">
            <CircleDot aria-hidden className="size-3.5" />
          </span>
          <h2 id="dashboard-tasks-pulse-title" className="truncate text-title font-semibold tracking-tight">{dictionary.tasks.pulseTitle}</h2>
        </div>
        {isLoading ? (
          <Skeleton className="h-6 w-20 shrink-0 rounded-full bg-[color:var(--project-hero-surface-raised)]" />
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--project-hero-border)] bg-[color:var(--project-hero-surface-raised)] px-2.5 py-1 text-micro font-semibold text-[color:var(--project-hero-muted)]">
            <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", needsAction > 0 ? "bg-[color:var(--project-risk-overdue)]" : "bg-[color:var(--brand-lime,var(--project-state-active))]")} />
            {statusLabel}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="relative mt-7" aria-hidden="true">
          <div className="flex items-end gap-2"><Skeleton className="h-10 w-12 rounded-lg bg-[color:var(--project-hero-surface-raised)]" /><Skeleton className="mb-1 h-4 w-32 rounded-full bg-[color:var(--project-hero-surface-raised)]" /></div>
          <Skeleton className="mt-6 h-2 w-full rounded-full bg-[color:var(--project-hero-surface-raised)]" />
          <div className="mt-4 space-y-2.5">{[0, 1, 2, 3, 4].map((index) => <Skeleton key={index} className="h-4 w-full rounded-full bg-[color:var(--project-hero-surface-raised)]" />)}</div>
          <div className="my-6 border-t border-[color:var(--project-hero-border)]" />
          <div className="grid grid-cols-7 gap-1">{Array.from({ length: 7 }, (_, index) => <Skeleton key={index} className="mx-auto h-10 w-7 rounded-full bg-[color:var(--project-hero-surface-raised)]" />)}</div>
          <div className="mt-6 space-y-3 border-t border-[color:var(--project-hero-border)] pt-5">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-4 w-full rounded-full bg-[color:var(--project-hero-surface-raised)]" />)}</div>
        </div>
      ) : (
        <>
          <div className="relative mt-7 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <strong className="text-kpi-lg text-[color:var(--project-hero-foreground)]">{needsAction}</strong>
            <span className="text-body font-semibold text-[color:var(--project-hero-muted)]">{dictionary.tasks.needsAction}</span>
          </div>

          <div className="relative mt-6 flex h-2 overflow-hidden rounded-full bg-[color:var(--project-hero-surface-raised)]" role="img" aria-label={`${dictionary.tasks.compositionLabel}. ${compositionAriaLabel}`}>
            {composition.map((item) => item.value > 0 ? (
              <span key={item.label} className="h-full min-w-1 first:rounded-l-full last:rounded-r-full" style={{ flex: item.value, background: item.color }} />
            ) : null)}
          </div>
          <div className="relative mt-4 space-y-2.5">
            {composition.map((item) => <TasksPulseLegendRow key={item.label} {...item} />)}
          </div>

          <div className="relative my-6 border-t border-[color:var(--project-hero-border)]" />

          <div className="relative">
            <span className="text-label font-semibold text-[color:var(--project-hero-muted)]">{dictionary.projects.nextSevenDays}</span>
            <TooltipProvider delayDuration={80}>
              <ol className="relative mt-4 grid grid-cols-7 gap-1" aria-label={`${upcomingTotal} ${upcomingTotal === 1 ? dictionary.tasks.taskDueOne : dictionary.tasks.tasksDueMany} ${dictionary.projects.withinNextSevenDays}`}>
                {upcomingDays.map((day) => {
                  const dayLabel = day.isToday ? dictionary.tasks.today : day.weekday;
                  const markerClassName = "relative flex h-8 w-7 items-center justify-center rounded-full text-data-sm";
                  return (
                    <li key={day.dateKey} className="flex min-w-0 flex-col items-center gap-2">
                      {day.count > 0 ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className={`${markerClassName} touch-manipulation bg-[color:var(--accent)] text-[color:var(--accent-foreground)] transition-[filter,box-shadow] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--project-hero-foreground)]`} aria-label={`${day.fullDate}: ${day.count} ${day.count === 1 ? dictionary.tasks.taskDueOne : dictionary.tasks.tasksDueMany}. ${day.tasks.map((task) => `${task.title}, ${task.projectName}`).join("; ")}`}>
                              {day.count}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="w-64 p-3">
                            <p className="text-label">{day.fullDate} · {day.count} {day.count === 1 ? dictionary.tasks.one : dictionary.tasks.many}</p>
                            <ul className="mt-2 space-y-2">
                              {day.tasks.map((task) => <li key={task.id}><p className="text-meta">{task.title}</p><p className="text-micro text-[color:var(--muted-foreground)]">{task.projectName}</p></li>)}
                            </ul>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className={`${markerClassName} border border-[color:var(--project-hero-border)] bg-[color:var(--project-hero-surface-raised)] text-[color:var(--project-hero-subtle)]`} aria-label={`${day.fullDate}: 0`}>
                          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
                        </span>
                      )}
                      <span className={cn("truncate text-micro", day.count > 0 ? "text-[color:var(--project-hero-muted)]" : "text-[color:var(--project-hero-subtle)]")}>{dayLabel}</span>
                    </li>
                  );
                })}
              </ol>
            </TooltipProvider>
          </div>

          <div className="relative mt-6 flex flex-col gap-3 border-t border-[color:var(--project-hero-border)] pt-5">
            <RhythmPeriodRow label={dictionary.tasks.dueThisWeek} value={dueThisWeek} isLoading={false} />
            <RhythmPeriodRow label={dictionary.tasks.overdue} value={overdue} isLoading={false} />
            <RhythmPeriodRow label={dictionary.tasks.openTotal} value={kpis?.total ?? 0} isLoading={false} />
          </div>
        </>
      )}
    </aside>
  );
}

export function TasksView({
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
  const tasksBaseHref = useTasksBaseHref();
  const showLoading = isLoading && !tasks;
  return (
    <div className="space-y-6">
      <PortalSectionHeading
        title={dictionary.tasks.title}
        subtitle={dictionary.tasks.subtitle}
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <PortalActionLink href={tasksBaseHref} prefetch={false}>
              {dictionary.tasks.viewAllAction}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </PortalActionLink>
            <TaskQuickCreateAction href={tasksBaseHref} label={dictionary.tasks.addNew} />
          </div>
        )}
      />
      <div className="dashboard-tasks-grid">
        <TasksTable
          rows={rows}
          title={dictionary.tasks.all}
          isLoading={isLoading}
          total={tasks?.kpis.total}
          hasMore={tasks?.pagination.hasMore}
          isLoadingMore={isLoadingMore}
          onLoadMore={onLoadMore}
          createHref={tasksBaseHref}
        />
        <TasksPulseCard tasks={tasks} isLoading={showLoading} />
      </div>
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

export function AttentionTasksCard({
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
          <DashboardCountPill count={tasks?.kpis.total ?? 0} label={dictionary.tasks.active} tone="accent" />
        )}
      </header>

      {isLoading && !tasks ? (
        <div>{Array.from({ length: capacity }, (_, index) => <Skeleton key={index} className="mx-5 my-3 h-12" />)}</div>
      ) : visibleTasks.length === 0 ? (
        <DashboardEmptyState
          className="min-h-52"
          icon={(
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--muted)] text-[color:var(--muted-foreground)]">
              <CheckCircle2 aria-hidden className="h-5 w-5" />
            </span>
          )}
          title={dictionary.tasks.allClear}
          description={dictionary.tasks.urgentEmpty}
        />
      ) : (
        <div>
          {visibleTasks.map((task) => {
            const attentionState = attentionStateFromTask(task, tasks!.generatedAt);
            return <DashboardTaskListRow key={task.id} task={task} href={buildDashboardProjectHref(projectBaseHref, task.projectId)} attentionState={attentionState ?? undefined} attentionLabel={attentionState ? labels[attentionState] : undefined} />;
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
