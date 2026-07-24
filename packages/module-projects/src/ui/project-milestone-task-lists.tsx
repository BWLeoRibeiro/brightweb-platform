"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarOff, ChevronDown, Flag, ListChecks, SquareKanban } from "lucide-react";
import { PROJECTS_EVENTS, dispatchProjectsEvent } from "./events";
import { ProjectProgressBar } from "./shared/project-progress";
import { portalMonoTabularClassName as MONO } from "./shared/typography";
import { ProjectSurfaceCard, ProjectSurfaceSectionHeader } from "./shared/project-surface-card";
import { SectionAddButton } from "./shared/section-icon-button";
import {
  TaskAssigneeMeta,
  TaskDueMeta,
  TaskMilestoneMeta,
  TaskPriorityTag,
  TaskStatusTag,
} from "./shared/task-tags";
import { TooltipProvider } from "@brightweblabs/ui";
import type { ProjectMilestone, ProjectTask } from "../types";
import { cn } from "./utils";
import { useProjectsNavigation, useProjectsUiDictionary } from "./context";
import type { ProjectsUiDictionary } from "./types";
import { defaultProjectsUiDictionary } from "./dictionary";

type ProjectMilestonesAndTasksListsProps = {
  projectId: string;
  canEditItems: boolean;
  milestones: ProjectMilestone[];
  tasks: ProjectTask[];
  onEditMilestone: (milestone: ProjectMilestone) => void;
  onEditTask: (task: ProjectTask) => void;
};

type TaskGroupKey = "overdue" | "today" | "this_week" | "later";
type TaskGroup = { key: TaskGroupKey; label: string; tasks: ProjectTask[] };

type CollapsedTaskGroupsState = Record<TaskGroupKey, boolean>;

const milestoneStatusDotClass: Record<string, string> = {
  pending: "bg-foreground/20",
  in_progress: "bg-[color:var(--project-state-active)]",
  achieved: "bg-[color:var(--project-state-completed)]",
  delayed: "bg-[color:var(--project-risk-overdue)]",
};

const taskPriorityOrder: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const taskGroupMeta: Array<{ key: TaskGroupKey; label: string }> = [
  { key: "overdue", label: defaultProjectsUiDictionary.detail.taskGroups.overdue },
  { key: "today", label: defaultProjectsUiDictionary.detail.taskGroups.today },
  { key: "this_week", label: defaultProjectsUiDictionary.detail.taskGroups.thisWeek },
  { key: "later", label: defaultProjectsUiDictionary.detail.taskGroups.later },
];

// Each group header carries a hint of its urgency: overdue red, today amber,
// this-week a light neutral, later a slightly darker neutral.
const taskGroupHeaderTone: Record<TaskGroupKey, { header: string; label: string }> = {
  overdue: {
    header:
      "bg-[color:var(--project-ui-color-20)] hover:bg-[color:var(--project-ui-color-21)]",
    label: "text-[color:var(--project-risk-overdue-strong)]",
  },
  today: {
    header:
      "bg-[color:var(--project-ui-color-14)] hover:bg-[color:var(--project-ui-color-22)]",
    label: "text-[color:var(--project-risk-at-risk-strong)]",
  },
  this_week: {
    header:
      "bg-[color:var(--project-ui-color-23)] hover:bg-[color:var(--project-ui-color-24)]",
    label: "text-[color:var(--muted-foreground)]",
  },
  later: {
    header:
      "bg-[color:var(--project-ui-color-25)] hover:bg-[color:var(--project-ui-color-26)]",
    label: "text-foreground/55",
  },
};

// Explicit label styling (11px/600/uppercase) so the per-group tone color wins
// deterministically over the shared portal-label utility's muted color.
const TASK_GROUP_LABEL_BASE = "text-[0.6875rem] font-semibold uppercase tracking-[0.06em]";

// How many tasks the detail-page bento previews before deferring to the board.
const PREVIEW_TASK_LIMIT = 7;

const initialCollapsedTaskGroups: CollapsedTaskGroupsState = {
  overdue: false,
  today: false,
  this_week: false,
  later: false,
};

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, amount: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function getTaskGroup(dueDate: string | null, todayKey: string, endOfWeekKey: string): TaskGroupKey {
  if (!dueDate) return "later";
  if (dueDate < todayKey) return "overdue";
  if (dueDate === todayKey) return "today";
  if (dueDate <= endOfWeekKey) return "this_week";
  return "later";
}

function compareDueDates(a: string | null, b: string | null) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}

function compareTasksInList(a: ProjectTask, b: ProjectTask) {
  const blockedRankA = a.status === "blocked" ? 0 : 1;
  const blockedRankB = b.status === "blocked" ? 0 : 1;
  if (blockedRankA !== blockedRankB) return blockedRankA - blockedRankB;

  const priorityRankA = taskPriorityOrder[a.priority] ?? Number.MAX_SAFE_INTEGER;
  const priorityRankB = taskPriorityOrder[b.priority] ?? Number.MAX_SAFE_INTEGER;
  if (priorityRankA !== priorityRankB) return priorityRankA - priorityRankB;

  const dueDateComparison = compareDueDates(a.dueDate, b.dueDate);
  if (dueDateComparison !== 0) return dueDateComparison;

  return a.title.localeCompare(b.title, "pt-PT", { sensitivity: "base" });
}

function milestoneVisualHealth(milestone: ProjectMilestone): "off_track" | "at_risk" | "on_track" | "neutral" | "completed" {
  if (milestone.status === "achieved") return "completed";
  if (milestone.status === "delayed" || milestone.health === "off_track") return "off_track";
  if (milestone.health === "at_risk") return "at_risk";
  if (milestone.health === "on_track") return "on_track";
  return "neutral";
}

function formatWeekday(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-PT", { weekday: "short" }).format(date).replace(".", "").toUpperCase();
}

function formatDayOfMonth(value: string | null | undefined) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return String(date.getDate()).padStart(2, "0");
}

function formatRelativeDue(value: string | null | undefined, dictionary: ProjectsUiDictionary): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return dictionary.detail.today;
  if (days === 1) return dictionary.detail.tomorrow;
  if (days === -1) return dictionary.detail.yesterday;
  if (days > 1) return dictionary.detail.inDays(days);
  return dictionary.detail.daysAgo(Math.abs(days));
}

// The calendar chip carries the milestone's health as its background, so the
// date tile doubles as the at-a-glance status (no separate rail/badge needed).
function milestoneChipClass(milestone: ProjectMilestone): string {
  switch (milestoneVisualHealth(milestone)) {
    case "off_track":
      return "bg-[color:var(--project-risk-overdue)] text-[color:var(--project-risk-overdue-ink)]";
    case "at_risk":
      return "bg-[color:var(--project-risk-at-risk)] text-[color:var(--project-risk-at-risk-ink)]";
    case "completed":
      return "bg-[color:var(--project-state-completed)] text-[color:var(--project-state-completed-ink)]";
    default:
      return "bg-[color:var(--project-ui-color-27)] text-[color:var(--foreground)]";
  }
}

function ProjectSectionEmptyState({ icon: Icon, title, hint }: { icon: typeof Flag; title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="flex size-11 items-center justify-center rounded-[var(--radius-card)] border border-border-hairline bg-[color:var(--muted)]">
        <Icon className="size-5 text-foreground/30" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground/60">{title}</p>
        <p className="mt-1 text-xs text-foreground-muted-accessible">{hint}</p>
      </div>
    </div>
  );
}

function ProjectTaskRow({
  task,
  milestoneTitle,
  isOverdue,
  onEdit,
}: {
  task: ProjectTask;
  milestoneTitle: string | null;
  isOverdue: boolean;
  onEdit: (task: ProjectTask) => void;
}) {
  const description = task.description?.trim();

  return (
    <button
      type="button"
      onClick={() => onEdit(task)}
      className="group relative flex w-full flex-col gap-1 border-t border-[color:var(--border)] px-3 py-2.5 text-left transition first:border-t-0 hover:bg-[color:var(--project-ui-color-09)]"
    >
      {/* Primary: title + due date */}
      <div className="flex min-w-0 items-start gap-2">
        <p className="portal-body min-w-0 flex-1 font-semibold leading-snug line-clamp-2" title={task.title}>
          {task.title}
        </p>
        <TaskDueMeta dueDate={task.dueDate} isOverdue={isOverdue} className="whitespace-nowrap pt-0.5" />
      </div>

      {/* Secondary: description */}
      {description ? (
        <p className="portal-meta line-clamp-1 text-[color:var(--muted-foreground)]" title={description}>
          {description}
        </p>
      ) : null}

      {/* Tertiary: signal tags */}
      <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5">
        <TaskPriorityTag task={task} />
        <TaskStatusTag task={task} />
        <TaskMilestoneMeta title={milestoneTitle} />
        <TaskAssigneeMeta label={task.assigneeLabel} className="ml-auto max-w-[7rem] pl-1" />
      </div>
    </button>
  );
}

function ProjectTaskGroupRows({
  group,
  isCollapsed,
  milestoneById,
  onEditTask,
  onToggle,
}: {
  group: TaskGroup;
  isCollapsed: boolean;
  milestoneById: Map<string, ProjectMilestone>;
  onEditTask: (task: ProjectTask) => void;
  onToggle: () => void;
}) {
  const sectionId = `project-task-group-${group.key}`;
  const tone = taskGroupHeaderTone[group.key];

  return (
    <section className="border-b border-[color:var(--border)] last:border-b-0">
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors",
          tone.header,
        )}
        onClick={onToggle}
        aria-expanded={!isCollapsed}
        aria-controls={sectionId}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <ChevronDown className={cn("size-3.5 transition-transform duration-200", tone.label, isCollapsed && "-rotate-90")} />
          <p className={cn(TASK_GROUP_LABEL_BASE, tone.label)}>{group.label}</p>
        </div>
        <span className={`${MONO} portal-micro`}>
          {group.tasks.length}
        </span>
      </button>

      <div id={sectionId} className={isCollapsed ? "hidden" : ""}>
        {group.tasks.map((task) => (
          <ProjectTaskRow
            key={task.id}
            task={task}
            milestoneTitle={task.milestoneId ? milestoneById.get(task.milestoneId)?.title ?? null : null}
            isOverdue={group.key === "overdue"}
            onEdit={onEditTask}
          />
        ))}
      </div>
    </section>
  );
}

export function ProjectMilestonesAndTasksLists({
  projectId,
  canEditItems,
  milestones,
  tasks,
  onEditMilestone,
  onEditTask,
}: ProjectMilestonesAndTasksListsProps) {
  const navigation = useProjectsNavigation();
  const dictionary = useProjectsUiDictionary();
  const milestoneStatusLabels: Record<string, string> = { pending: dictionary.status.pending, in_progress: dictionary.status.in_progress, achieved: dictionary.status.achieved, delayed: dictionary.status.delayed };
  const [collapsedTaskGroups, setCollapsedTaskGroups] = useState<CollapsedTaskGroupsState>(initialCollapsedTaskGroups);

  const milestoneById = useMemo(() => new Map(milestones.map((m) => [m.id, m])), [milestones]);
  const visibleTasks = useMemo(() => tasks.filter((task) => task.status !== "done"), [tasks]);

  // Child-task progress per milestone — expresses the milestone → tasks relationship.
  const taskProgressByMilestone = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>();
    for (const task of tasks) {
      if (!task.milestoneId) continue;
      const entry = map.get(task.milestoneId) ?? { done: 0, total: 0 };
      entry.total += 1;
      if (task.status === "done") entry.done += 1;
      map.set(task.milestoneId, entry);
    }
    return map;
  }, [tasks]);

  const groupedTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = toDateKey(today);
    const endOfWeekKey = toDateKey(addDays(today, 6));
    const groups: Record<TaskGroupKey, ProjectTask[]> = {
      overdue: [],
      today: [],
      this_week: [],
      later: [],
    };

    for (const task of visibleTasks) {
      groups[getTaskGroup(task.dueDate, todayKey, endOfWeekKey)].push(task);
    }

    for (const groupKey of Object.keys(groups) as TaskGroupKey[]) {
      groups[groupKey].sort(compareTasksInList);
    }

    return taskGroupMeta.map((group) => ({
      ...group,
      tasks: groups[group.key],
    }));
  }, [visibleTasks]);

  // The bento is a focused preview: fill it with the most urgent tasks first
  // (overdue → today → this week → later) up to PREVIEW_TASK_LIMIT, then send
  // the rest to "Ver mais" (the Kanban board) so the card always looks full.
  const visibleTaskGroups = useMemo(() => {
    let remaining = PREVIEW_TASK_LIMIT;
    const result: typeof groupedTasks = [];
    for (const group of groupedTasks) {
      if (remaining <= 0) break;
      if (group.tasks.length === 0) continue;
      const slice = group.tasks.slice(0, remaining);
      result.push({ ...group, tasks: slice });
      remaining -= slice.length;
    }
    return result;
  }, [groupedTasks]);

  const shownTaskCount = visibleTaskGroups.reduce((total, group) => total + group.tasks.length, 0);
  const hiddenTaskCount = visibleTasks.length - shownTaskCount;

  return (
    <TooltipProvider>
      <>
        <ProjectSurfaceCard className="is-light flex h-full flex-col">
          <ProjectSurfaceSectionHeader
            icon={Flag}
            title={dictionary.detail.milestones}
            subtitle={dictionary.detail.milestonesSubtitle}
            rightSlot={canEditItems ? (
              <SectionAddButton
                label={dictionary.detail.addMilestone}
                onClick={() => dispatchProjectsEvent(PROJECTS_EVENTS.openNewMilestone)}
              />
            ) : null}
          />
          <div className="portal-scroll mt-4 rounded-[var(--radius-card)] border border-[color:var(--border)] xl:max-h-[28rem]">
            {milestones.length === 0 ? (
              <ProjectSectionEmptyState
                icon={Flag}
                title={dictionary.detail.noMilestones}
                hint={dictionary.detail.noMilestonesHint}
              />
            ) : null}
            {milestones.map((milestone) => {
              const progress = taskProgressByMilestone.get(milestone.id);
              const relativeDue = formatRelativeDue(milestone.targetDate, dictionary);
              const isProgressComplete = progress ? progress.total > 0 && progress.done >= progress.total : false;
              const isAchieved = milestone.status === "achieved";
              const isOverdue = !isAchieved && milestoneVisualHealth(milestone) === "off_track";
              const hasDate = Boolean(milestone.targetDate);

              return (
                <button
                  key={milestone.id}
                  type="button"
                  onClick={() => onEditMilestone(milestone)}
                  className={cn(
                    "group relative flex w-full items-center gap-3 border-t border-[color:var(--border)] px-2 py-2 text-left transition first:border-t-0 hover:bg-[color:var(--project-ui-color-09)]",
                    isAchieved && "opacity-60",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-12 w-12 shrink-0 flex-col items-center justify-center gap-[3px] rounded-lg text-center leading-none",
                      hasDate
                        ? milestoneChipClass(milestone)
                        : "border border-dashed border-[color:var(--project-ui-color-28)] text-[color:var(--muted-foreground)]",
                    )}
                  >
                    {hasDate ? (
                      <>
                        <span className="block text-[7px] font-bold leading-none tracking-[0.04em] opacity-70">
                          {formatWeekday(milestone.targetDate)}
                        </span>
                        <span className={`${MONO} block text-[16px] font-extrabold leading-none`}>
                          {formatDayOfMonth(milestone.targetDate)}
                        </span>
                      </>
                    ) : (
                      <>
                        <CalendarOff className="size-4 opacity-60" />
                        <span className="block text-[7px] font-semibold uppercase tracking-[0.04em] opacity-70">{dictionary.detail.noDateShort}</span>
                      </>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={cn("portal-body min-w-0 flex-1 truncate font-semibold", isAchieved && "text-[color:var(--muted-foreground)]")}>{milestone.title}</p>
                      {progress && progress.total > 0 ? (
                        <span className="flex shrink-0 items-center gap-2">
                          <ProjectProgressBar
                            completed={progress.done}
                            total={progress.total}
                            className="w-16 bg-[color:var(--project-ui-color-29)]"
                            fillClassName={isProgressComplete ? "bg-[color:var(--project-state-active)]" : "bg-[color:var(--accent)]"}
                          />
                          <span className={`${MONO} portal-meta tabular-nums text-foreground/70`}>{progress.done}/{progress.total}</span>
                        </span>
                      ) : (
                        <span className="portal-micro shrink-0 text-foreground-muted-accessible">{dictionary.detail.noTasksLowercase}</span>
                      )}
                    </div>
                    <div className="portal-meta mt-1 flex min-w-0 items-center gap-x-2 whitespace-nowrap">
                      <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
                        <span className={cn("size-1.5 shrink-0 rounded-full", milestoneStatusDotClass[milestone.status] ?? "bg-slate-400/70")} />
                        {milestoneStatusLabels[milestone.status] ?? milestone.status}
                      </span>
                      {relativeDue ? (
                        <>
                          <span className="text-foreground/25">·</span>
                          <span className={cn("shrink-0 whitespace-nowrap", isOverdue && "font-semibold text-[color:var(--project-risk-overdue-strong)]")}>{relativeDue}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </ProjectSurfaceCard>

        <ProjectSurfaceCard className="is-light flex h-full flex-col xl:col-span-2">
          <ProjectSurfaceSectionHeader
            icon={ListChecks}
            title={dictionary.detail.tasks}
            subtitle={dictionary.detail.tasksSubtitle}
            rightSlot={canEditItems ? (
              <SectionAddButton
                label={dictionary.detail.addTask}
                onClick={() => dispatchProjectsEvent(PROJECTS_EVENTS.openNewTask)}
              />
            ) : null}
          />
          <div className="portal-scroll mt-4 rounded-[var(--radius-card)] border border-[color:var(--border)] xl:max-h-[28rem]">
            {visibleTasks.length === 0 ? (
              <ProjectSectionEmptyState
                icon={ListChecks}
                title={dictionary.detail.noTasks}
                hint={dictionary.detail.noTasksHint}
              />
            ) : null}
            {visibleTaskGroups.map((taskGroup) => {
              const isCollapsed = collapsedTaskGroups[taskGroup.key] ?? false;

              return (
                <ProjectTaskGroupRows
                  key={taskGroup.key}
                  group={taskGroup}
                  isCollapsed={isCollapsed}
                  milestoneById={milestoneById}
                  onEditTask={onEditTask}
                  onToggle={() => {
                    setCollapsedTaskGroups((current) => ({
                      ...current,
                      [taskGroup.key]: !current[taskGroup.key],
                    }));
                  }}
                />
              );
            })}
            {hiddenTaskCount > 0 ? (
              <Link
                href={navigation.boardHref(projectId)}
                className="portal-meta flex items-center justify-center gap-1.5 border-t border-[color:var(--border)] px-3 py-2 font-semibold text-[color:var(--muted-foreground)] transition-colors hover:bg-[color:var(--project-ui-color-09)] hover:text-[color:var(--accent)]"
              >
                <SquareKanban className="size-3.5" />
                {dictionary.detail.moreTasks(hiddenTaskCount)}
              </Link>
            ) : null}
          </div>
        </ProjectSurfaceCard>
      </>
    </TooltipProvider>
  );
}
