import type { CSSProperties, ReactNode } from "react";
import { CalendarDays, CalendarOff, Flag, User } from "lucide-react";
import { portalMonoTabularClassName as MONO } from "./typography";
import type { ProjectTask } from "../../types";
import { tintPill } from "@brightweblabs/theme/tint";
import { cn } from "../utils";
import { defaultProjectsUiDictionary } from "../dictionary";

/** A canonical tint plus the bespoke "medium priority" accent tint. */
type TintResult = { className: string; style?: CSSProperties };

// Single source of truth for task tag/meta presentation, shared by the project
// detail bento (project-milestone-task-lists) and the Kanban board so the two
// never drift apart.

export const taskPriorityLabels: Record<string, string> = {
  low: defaultProjectsUiDictionary.board.priority.low,
  medium: defaultProjectsUiDictionary.board.priority.medium,
  high: defaultProjectsUiDictionary.board.priority.high,
  urgent: defaultProjectsUiDictionary.board.priority.urgent,
};

export const taskStatusLabels: Record<string, string> = {
  todo: defaultProjectsUiDictionary.board.columns.todo,
  in_progress: defaultProjectsUiDictionary.board.columns.in_progress,
  blocked: defaultProjectsUiDictionary.board.columns.blocked,
  done: defaultProjectsUiDictionary.board.columns.done,
};

export function formatTaskShortDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short" }).format(date);
}

// Small pill used in task meta rows. Keeps the icon/label rhythm consistent.
export function TaskTag({ className, children, title, style }: { className?: string; children: ReactNode; title?: string; style?: CSSProperties }) {
  return (
    <span
      title={title}
      style={style}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-[1px] text-[10px] font-semibold",
        className,
      )}
    >
      {children}
    </span>
  );
}

// Untinted "not started" / "todo" pill — quiet neutral surface.
const NEUTRAL_TAG = "border-border-hairline-soft bg-[color:var(--elevate-1)] text-[color:var(--muted-foreground)]";

// Full color ladder so every task carries a priority hue at a glance. All hues
// run through the canonical `.tint-soft` recipe (one set of opacity stops).
export function priorityTagClass(priority: string, status?: ProjectTask["status"]): TintResult {
  if (status === "blocked" || priority === "urgent") return tintPill("--project-risk-overdue");
  if (priority === "high") return tintPill("--project-risk-at-risk");
  if (priority === "medium") {
    // Brand-accent tint — accent has no `-strong` pair, so mix toward foreground
    // for legible text while keeping the canonical border/bg stops.
    return {
      className: "tint-soft",
      style: {
        "--tint": "var(--accent)",
        "--tint-strong": "var(--project-ui-color-83)",
      } as CSSProperties,
    };
  }
  return tintPill("--project-state-completed");
}

export function statusTagClass(status: ProjectTask["status"]): TintResult {
  if (status === "blocked") return tintPill("--project-risk-overdue");
  if (status === "in_progress") return tintPill("--project-state-active");
  if (status === "done") return tintPill("--project-state-completed");
  return { className: NEUTRAL_TAG };
}

export function statusDotClass(status: ProjectTask["status"]) {
  if (status === "blocked") return "bg-[color:var(--project-risk-overdue)]";
  if (status === "in_progress") return "bg-[color:var(--project-state-active)]";
  if (status === "done") return "bg-[color:var(--project-state-completed)]";
  return "bg-foreground/30";
}

export function TaskPriorityTag({ task }: { task: Pick<ProjectTask, "priority" | "status"> }) {
  const label = taskPriorityLabels[task.priority] ?? task.priority;
  const tint = priorityTagClass(task.priority, task.status);
  return (
    <TaskTag className={tint.className} style={tint.style} title={defaultProjectsUiDictionary.board.priorityTooltip(label)}>
      {label}
    </TaskTag>
  );
}

export function TaskStatusTag({ task }: { task: Pick<ProjectTask, "status" | "blockedReason"> }) {
  const isBlocked = task.status === "blocked";
  const fullText = isBlocked ? task.blockedReason?.trim() || defaultProjectsUiDictionary.board.columns.blocked : taskStatusLabels[task.status] ?? task.status;
  const tint = statusTagClass(task.status);
  return (
    <TaskTag className={tint.className} style={tint.style} title={fullText}>
      <span className={cn("size-1.5 rounded-full", statusDotClass(task.status))} />
      {isBlocked ? defaultProjectsUiDictionary.board.columns.blocked : fullText}
    </TaskTag>
  );
}

// Graceful "not set" meta pieces — dimmer when the value is missing so absence
// reads as intentional rather than just disappearing.
export function TaskMilestoneMeta({ title, className }: { title: string | null; className?: string }) {
  return (
    <span
      className={cn("portal-micro inline-flex min-w-0 items-center gap-1", title ? "text-foreground/45" : "text-foreground/30", className)}
      title={title ?? defaultProjectsUiDictionary.board.noMilestoneAssociated}
    >
      <Flag className="size-3 shrink-0" />
      <span className="truncate">{title ?? defaultProjectsUiDictionary.board.noMilestoneShort}</span>
    </span>
  );
}

export function TaskAssigneeMeta({ label, className }: { label: string | null; className?: string }) {
  return (
    <span
      className={cn("portal-micro inline-flex min-w-0 items-center gap-1", label ? "text-foreground/45" : "text-foreground/30", className)}
      title={label ?? defaultProjectsUiDictionary.board.noAssignee}
    >
      <User className="size-3 shrink-0" />
      <span className="truncate">{label ?? defaultProjectsUiDictionary.board.noAssignee}</span>
    </span>
  );
}

export function TaskDueMeta({
  dueDate,
  isOverdue = false,
  className,
}: {
  dueDate: string | null;
  isOverdue?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        `${MONO} portal-micro inline-flex shrink-0 items-center gap-1`,
        dueDate
          ? isOverdue
            ? "font-semibold text-[color:var(--project-risk-overdue-strong)]"
            : "text-[color:var(--muted-foreground)]"
          : "text-foreground/30",
        className,
      )}
      title={dueDate ? undefined : defaultProjectsUiDictionary.board.noDateDefined}
    >
      {dueDate ? <CalendarDays className="size-3" /> : <CalendarOff className="size-3" />}
      {dueDate ? formatTaskShortDate(dueDate) : defaultProjectsUiDictionary.board.noDate}
    </span>
  );
}
