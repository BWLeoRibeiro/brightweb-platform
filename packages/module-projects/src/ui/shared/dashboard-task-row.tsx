"use client";

import Link from "next/link";
import type {
  DashboardAssignedTask,
  DashboardTaskAttentionState,
} from "@brightweblabs/app-shell";
import { cn } from "../utils";
import {
  TaskDueMeta,
  TaskPriorityTag,
  TaskStatusTag,
  TaskTag,
} from "./task-tags";

const ATTENTION_TAG_CLASS: Record<Exclude<DashboardTaskAttentionState, "blocked">, string> = {
  overdue: "border-[color:var(--project-risk-overdue)]/35 bg-[color:var(--dashboard-task-risk-bg)] text-[color:var(--project-risk-overdue-strong)]",
  today: "border-[color:var(--project-risk-at-risk)]/35 bg-[color:var(--dashboard-task-due-bg)] text-[color:var(--project-risk-at-risk-strong)]",
  soon: "border-[color:var(--project-risk-at-risk)]/25 bg-[color:var(--dashboard-task-due-bg)] text-[color:var(--project-risk-at-risk-strong)]",
};

export function DashboardTaskRow({
  task,
  href,
  attentionState,
  attentionLabel,
}: {
  task: DashboardAssignedTask;
  href: string;
  attentionState?: DashboardTaskAttentionState;
  attentionLabel?: string;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="group relative flex min-h-[4.5rem] w-full flex-col justify-center gap-1 border-t border-[color:var(--border)] px-5 py-2.5 text-left transition first:border-t-0 hover:bg-[color:var(--dashboard-task-row-hover)]"
    >
      <div className="flex min-w-0 items-start gap-2">
        <p className="text-body text-foreground min-w-0 flex-1 truncate font-semibold leading-snug" title={task.title}>
          {task.title}
        </p>
        <TaskDueMeta
          dueDate={task.dueDate}
          isOverdue={attentionState === "overdue"}
          className="whitespace-nowrap pt-0.5"
        />
      </div>

      <div className="mt-0.5 flex min-w-0 items-center gap-1.5 overflow-hidden">
        {attentionState && attentionState !== "blocked" && attentionLabel ? (
          <TaskTag className={cn(ATTENTION_TAG_CLASS[attentionState])}>{attentionLabel}</TaskTag>
        ) : null}
        <TaskPriorityTag task={task} />
        <TaskStatusTag task={task} />
        <span
          className="text-label text-muted-foreground ml-auto max-w-[8rem] truncate font-mono"
          title={task.projectCode ?? task.projectName}
        >
          {task.projectCode ?? task.projectName}
        </span>
      </div>
    </Link>
  );
}
