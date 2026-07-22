"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CalendarDays, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { portalMonoTabularClassName as MONO } from "./typography";
import { ProjectOwnerAvatar } from "./project-owner-avatar";
import { PROJECT_RISK_META, resolveProjectRisk } from "./project-risk";
import { getCompletionPercent } from "./project-progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@brightweblabs/ui";
import type { ProjectListItem } from "../../types";
import { useProjectsNavigation, useProjectsUiDictionary } from "../context";

const SURFACE =
  "rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--card)] shadow-[0_1px_2px_var(--project-ui-color-67)]";

export type ProjectSummaryCardItem = Pick<
  ProjectListItem,
  "id" | "organizationName" | "name" | "code" | "status" | "health" | "ownerLabel" | "targetDate" | "taskStats"
>;

function formatShortDate(iso: string | null | undefined) {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short" }).format(date);
}

function codeOf(project: ProjectSummaryCardItem) {
  return project.code ?? project.id.slice(0, 8).toUpperCase();
}

export function ProjectSummaryCard({ project }: { project: ProjectSummaryCardItem }) {
  const navigation = useProjectsNavigation();
  const dictionary = useProjectsUiDictionary();
  const router = useRouter();
  const projectStatusMeta: Record<ProjectSummaryCardItem["status"], { label: string; dot: string }> = {
    planned: { label: dictionary.status.planned, dot: "bg-[color:var(--project-state-planned)]" },
    active: { label: dictionary.status.active, dot: "bg-[color:var(--project-state-active)]" },
    blocked: { label: dictionary.status.blocked, dot: "bg-[color:var(--project-state-blocked)]" },
    completed: { label: dictionary.status.completed, dot: "bg-[color:var(--project-state-completed)]" },
    canceled: { label: dictionary.status.canceled, dot: "bg-[color:var(--project-state-canceled)]" },
  };
  const statusMeta = projectStatusMeta[project.status] ?? projectStatusMeta.active;
  const risk = resolveProjectRisk(project);
  const riskMeta = risk ? PROJECT_RISK_META[risk] : null;
  const progress = getCompletionPercent(project.taskStats?.done ?? 0, project.taskStats?.total ?? 0);
  const isComplete = progress >= 100;
  const projectCode = codeOf(project);
  const projectHref = navigation.detailHref(project.id);
  // late/at-risk projects carry their tone through to the target date
  const dateTone = riskMeta ? riskMeta.var : "var(--foreground)";

  function openProject() {
    router.push(projectHref);
  }

  function openProjectFromKeyboard(event: KeyboardEvent<HTMLElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openProject();
  }

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
      <article
        role="link"
        tabIndex={0}
        className={`${SURFACE} group relative flex cursor-pointer flex-col overflow-hidden px-[17px] pb-4 pt-[14px] transition hover:-translate-y-0.5 hover:border-[color:var(--project-ui-color-68)] hover:shadow-[0_12px_30px_var(--project-ui-color-72)]`}
        onClick={openProject}
        onKeyDown={openProjectFromKeyboard}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="absolute right-[15px] top-[15px] z-10 inline-flex h-4 w-4 items-center justify-center">
              <ArrowUpRight className="h-3.5 w-3.5 text-[color:var(--muted-foreground)] opacity-0 transition group-hover:text-[color:var(--accent)] group-hover:opacity-100" />
            </span>
          </TooltipTrigger>
          <TooltipContent>{dictionary.detail.openProject}</TooltipContent>
        </Tooltip>

        {/* header — fixed height so pills/progress align across cards */}
        <p className="portal-label truncate pr-6">
          {project.organizationName ?? "-"}
        </p>
        <h3 className="portal-card-title mt-1 line-clamp-2 min-h-[2.6em] font-bold leading-[1.3]">
          {project.name}
        </h3>

        {/* status (quiet dot) + risk (chip) — fixed height so the chip never grows the row */}
        <div className="mt-3 flex min-h-[24px] items-center gap-x-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="pointer-events-auto inline-flex items-center gap-1.5 text-[12px] font-semibold text-[color:var(--foreground)]">
                <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${statusMeta.dot}`} />
                {statusMeta.label}
              </span>
            </TooltipTrigger>
            <TooltipContent>{dictionary.detail.statusTooltip(statusMeta.label)}</TooltipContent>
          </Tooltip>
          {riskMeta ? (
            <span
              className="inline-flex items-center rounded-full border px-2 py-[3px] text-[11px] font-bold"
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
          <div className="portal-meta flex items-center justify-between">
            <span className="inline-flex min-w-0 items-center gap-2">
              <ProjectOwnerAvatar label={project.ownerLabel} size="sm" roleColor="manager" />
              <span className="truncate">{project.ownerLabel ?? dictionary.detail.noOwnerLowercase}</span>
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={`${MONO} pointer-events-auto text-[13px] font-extrabold text-[color:var(--foreground)]`}>
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
        <div className="portal-meta mt-auto flex min-w-0 items-center justify-between gap-3 border-t border-[color:var(--border)] pt-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={`${MONO} portal-micro pointer-events-auto min-w-0 max-w-[44%] truncate text-left tracking-[0.06em] transition hover:text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]`}
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
                <ListChecks className="h-3.5 w-3.5 opacity-70" strokeWidth={1.75} />
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
                <CalendarDays className="h-3.5 w-3.5 opacity-70" strokeWidth={1.75} />
                <span className={`${MONO} font-bold`} style={{ color: dateTone }}>
                  {formatShortDate(project.targetDate)}
                </span>
              </span>
            </TooltipTrigger>
            <TooltipContent>{dictionary.detail.dueDate}</TooltipContent>
          </Tooltip>
        </div>
      </article>
    </TooltipProvider>
  );
}
