"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { monoTabularClassName as MONO } from "./typography";
import { ProjectOwnerAvatar } from "./project-owner-avatar";
import { PROJECT_RISK_META, resolveProjectRisk } from "./project-risk";
import { getCompletionPercent } from "./project-progress";
import { Card, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@brightweblabs/ui";
import type { ProjectListItem } from "../../types";
import { useProjectsNavigation, useProjectsUiDictionary } from "../context";
import { formatProjectDayMonth } from "./formatters";
import { useProjectsNow } from "./use-projects-now";

export type ProjectSummaryCardItem = Pick<
  ProjectListItem,
  "id" | "organizationName" | "name" | "code" | "status" | "health" | "ownerLabel" | "targetDate" | "taskStats"
>;

function codeOf(project: ProjectSummaryCardItem) {
  return project.code ?? project.id.slice(0, 8).toUpperCase();
}

export function ProjectSummaryCard({ project }: { project: ProjectSummaryCardItem }) {
  const navigation = useProjectsNavigation();
  const dictionary = useProjectsUiDictionary();
  const now = useProjectsNow();
  const projectStatusMeta: Record<ProjectSummaryCardItem["status"], { label: string }> = {
    planned: { label: dictionary.status.planned },
    active: { label: dictionary.status.active },
    paused: { label: dictionary.status.paused },
    blocked: { label: dictionary.status.blocked },
    completed: { label: dictionary.status.completed },
    canceled: { label: dictionary.status.canceled },
  };
  const statusMeta = projectStatusMeta[project.status] ?? projectStatusMeta.active;
  const risk = resolveProjectRisk(project, now);
  const riskMeta = risk ? PROJECT_RISK_META[risk] : null;
  const progress = getCompletionPercent(project.taskStats?.done ?? 0, project.taskStats?.total ?? 0);
  const isComplete = progress >= 100;
  const projectCode = codeOf(project);
  const projectHref = navigation.detailHref(project.id);
  // late/at-risk projects carry their tone through to the target date
  const dateTone = riskMeta ? riskMeta.var : "var(--foreground)";

  async function copyProjectId(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(projectCode);
      toast.success(dictionary.messages.projectIdCopied);
    } catch {
      toast.error(dictionary.messages.projectIdCopyError);
    }
  }

  return (
    <TooltipProvider>
      <Card asChild variant="interactive">
        <article className="group relative overflow-hidden px-[17px] pb-4 pt-[14px]">
        <span aria-hidden className="pointer-events-none absolute right-[15px] top-[15px] inline-flex h-4 w-4 items-center justify-center">
          <ArrowUpRight className="h-3.5 w-3.5 text-[color:var(--muted-foreground)] opacity-0 transition group-hover:text-[color:var(--accent)] group-hover:opacity-100 motion-reduce:transition-none" />
        </span>

        {/* header — fixed height so pills/progress align across cards */}
        <p className="text-label text-muted-foreground truncate pr-6">
          {project.organizationName ?? "-"}
        </p>
        <h3 className="text-title text-foreground mt-1 line-clamp-2 min-h-[2.6em] font-bold leading-[var(--type-leading-130)]">
          <Link
            href={projectHref}
            prefetch={false}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {project.name}
          </Link>
        </h3>

        {/* status (quiet dot) + risk (chip) — fixed height so the chip never grows the row */}
        <div className="mt-3 flex min-h-[24px] items-center gap-x-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="pointer-events-auto relative z-10 inline-flex items-center gap-1.5 text-meta font-semibold text-[color:var(--foreground)]">
                {statusMeta.label}
              </span>
            </TooltipTrigger>
            <TooltipContent>{dictionary.detail.statusTooltip(statusMeta.label)}</TooltipContent>
          </Tooltip>
          {riskMeta ? (
            <span
              className="inline-flex items-center rounded-full border px-2 py-[3px] text-label font-bold"
              style={{
                color: riskMeta.var,
                ["--project-dynamic-risk" as string]: riskMeta.var,
                background: `var(--project-ui-color-69)`,
                borderColor: `var(--project-ui-color-70)`,
              }}
            >
              {riskMeta.label}
            </span>
          ) : null}
        </div>

        {/* owner + progress */}
        <div className="mt-3.5">
          <div className="text-meta text-muted-foreground flex items-center justify-between">
            <span className="inline-flex min-w-0 items-center gap-2">
              <ProjectOwnerAvatar label={project.ownerLabel} size="sm" roleColor="manager" />
              <span className="truncate">{project.ownerLabel ?? dictionary.detail.noOwnerLowercase}</span>
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={`${MONO} pointer-events-auto relative z-10 text-body text-[length:var(--text-ui-action)] font-extrabold text-[color:var(--foreground)]`}>
                  {progress}%
                </span>
              </TooltipTrigger>
              <TooltipContent>{dictionary.detail.progressTooltip(progress)}</TooltipContent>
            </Tooltip>
          </div>
          <div className="mt-[7px] h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--project-ui-color-71)]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: isComplete ? "var(--project-state-active)" : "var(--accent)",
              }}
            />
          </div>
        </div>

        {/* footer — pinned to bottom */}
        <div className="text-meta text-muted-foreground mt-auto flex min-w-0 items-center justify-between gap-3 border-t border-[color:var(--border)] pt-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={`${MONO} text-micro text-muted-foreground pointer-events-auto relative z-10 min-w-0 max-w-[44%] truncate text-left transition hover:text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] motion-reduce:transition-none`}
                onClick={copyProjectId}
              >
                {projectCode}
              </button>
            </TooltipTrigger>
            <TooltipContent>{dictionary.detail.copyProjectId}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
                <ListChecks aria-hidden className="h-3.5 w-3.5 opacity-70" strokeWidth={1.75} />
                <span className={MONO}>
                  {project.taskStats.done}/{project.taskStats.total}
                </span>
              </span>
            </TooltipTrigger>
            <TooltipContent>{dictionary.detail.completedTasks}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap" style={{ color: dateTone }}>
                <CalendarDays aria-hidden className="h-3.5 w-3.5 opacity-70" strokeWidth={1.75} />
                <span className={`${MONO} font-bold`} style={{ color: dateTone }}>
                  {formatProjectDayMonth(project.targetDate)}
                </span>
              </span>
            </TooltipTrigger>
            <TooltipContent>{dictionary.detail.dueDate}</TooltipContent>
          </Tooltip>
        </div>
        </article>
      </Card>
    </TooltipProvider>
  );
}
