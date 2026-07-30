import Link from "next/link";
import { ArrowRight, CalendarDays, Flag, FolderKanban } from "lucide-react";
import type { ProjectListItem } from "../../data";
import {
  CLIENT_PROJECT_HEALTH_LABELS,
  CLIENT_PROJECT_HEALTH_VAR,
  CLIENT_PROJECT_STATUS_LABELS,
  CLIENT_PROJECT_STATUS_STYLES,
  clientProjectsDictionary,
} from "./dictionary";
import {
  formatClientProjectDate,
  isClientProjectDateOverdue,
  resolveClientProjectDetailHref,
} from "./shared";

export function ProjectListCard({
  project,
  isStaff,
}: {
  project: ProjectListItem;
  isStaff: boolean;
}) {
  const healthVar = CLIENT_PROJECT_HEALTH_VAR[project.health];
  const milestoneProgressPct =
    project.milestoneStats.total > 0
      ? Math.round(
        (project.milestoneStats.achieved / project.milestoneStats.total) * 100,
      )
      : null;
  const overdue =
    isClientProjectDateOverdue(project.targetDate)
    && project.status !== "completed"
    && project.status !== "canceled";
  const href = resolveClientProjectDetailHref(isStaff, project.id);
  const dictionary = clientProjectsDictionary.list;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-border/70 bg-background/70 transition-shadow hover:shadow-md">
      <div className="h-[3px] w-full shrink-0" style={{ background: healthVar }} />

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-label font-semibold ${CLIENT_PROJECT_STATUS_STYLES[project.status]}`}
          >
            {CLIENT_PROJECT_STATUS_LABELS[project.status]}
          </span>
          <span
            className="inline-flex items-center gap-1 text-label font-semibold"
            style={{ color: healthVar }}
          >
            <span className="size-1.5 rounded-full" style={{ background: healthVar }} />
            {CLIENT_PROJECT_HEALTH_LABELS[project.health]}
          </span>
        </div>

        <div>
          {project.code ? (
            <p className="mb-0.5 select-all font-mono text-micro text-muted-foreground/60">
              {project.code}
            </p>
          ) : null}
          <h2 className="text-body-lg font-semibold leading-snug">{project.name}</h2>
          <p className="mt-0.5 text-meta text-muted-foreground">{project.organizationName}</p>
        </div>

        {project.summary ? (
          <p className="line-clamp-2 text-body text-muted-foreground">{project.summary}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-meta text-muted-foreground">
          <span
            className={`inline-flex items-center gap-1.5 ${overdue ? "font-semibold" : ""}`}
            style={overdue ? { color: "var(--project-health-off-track)" } : undefined}
          >
            <CalendarDays className="size-3.5 shrink-0" />
            {formatClientProjectDate(project.targetDate)}
            {overdue ? <span className="text-micro">({clientProjectsDictionary.common.delayed})</span> : null}
          </span>

          <span
            className="inline-flex items-center gap-1.5"
            style={
              project.milestoneStats.delayed > 0
                ? { color: "var(--project-health-off-track)" }
                : undefined
            }
          >
            <Flag className="size-3.5 shrink-0" />
            {project.milestoneStats.total > 0
              ? dictionary.milestones(
                project.milestoneStats.achieved,
                project.milestoneStats.total,
              )
              : dictionary.noMilestones}
            {project.milestoneStats.delayed > 0 ? (
              <span className="text-micro">
                {dictionary.delayedMilestones(project.milestoneStats.delayed)}
              </span>
            ) : null}
          </span>
        </div>

        {milestoneProgressPct !== null ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-micro text-muted-foreground">
                {dictionary.milestoneProgress}
              </span>
              <span
                className="text-micro font-bold tabular-nums"
                style={{ color: healthVar }}
              >
                {milestoneProgressPct}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
                style={{ width: `${milestoneProgressPct}%`, background: healthVar }}
              />
            </div>
          </div>
        ) : null}

        <div className="mt-auto pt-1">
          <Link
            href={href}
            className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-body font-semibold text-foreground transition-[color,background-color,border-color] hover:border-border hover:bg-muted/60 motion-reduce:transition-none"
          >
            <span className="inline-flex items-center gap-2">
              <FolderKanban className="size-4 text-muted-foreground" />
              {dictionary.open}
            </span>
            <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:transform-none" />
          </Link>
        </div>
      </div>
    </article>
  );
}
