import Link from "next/link";
import { ArrowRight, CalendarDays, Flag, FolderKanban } from "lucide-react";
import { Card } from "@brightweblabs/ui";
import type { ClientProjectListItem } from "../../client-contracts";
import {
  CLIENT_PROJECT_STATUS_LABELS,
  CLIENT_PROJECT_STATUS_STYLES,
  clientProjectsDictionary,
} from "./dictionary";
import {
  formatClientProjectDate,
  isClientProjectDateOverdue,
  resolveClientMetaPreview,
  resolveClientProjectDetailHref,
} from "./shared";

export function ProjectListCard({
  project,
  showOrganizations = true,
  emphasis = false,
}: {
  project: ClientProjectListItem;
  showOrganizations?: boolean;
  emphasis?: boolean;
}) {
  const milestoneProgressPct = project.progress.percent;
  const overdue = isClientProjectDateOverdue(project.targetDate)
    && project.status !== "completed"
    && project.status !== "canceled";
  const href = resolveClientProjectDetailHref(false, project.id);
  const dictionary = clientProjectsDictionary.list;
  const metaPreview = resolveClientMetaPreview(project.metaPreview);

  return (
    <Card asChild variant="light">
      <article className={`group relative overflow-hidden bg-background/70 transition-shadow hover:shadow-md motion-reduce:transition-none ${emphasis ? "min-h-[20rem] shadow-md" : ""}`}>
      <div className="h-[3px] w-full shrink-0 bg-primary" />

      <div className={`flex flex-1 flex-col gap-3 ${emphasis ? "p-6 sm:p-8" : "p-4"}`}>
        <div className="flex items-center">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-label font-semibold ${CLIENT_PROJECT_STATUS_STYLES[project.status]}`}
          >
            {CLIENT_PROJECT_STATUS_LABELS[project.status]}
          </span>
        </div>

        <div>
          {project.reference ? (
            <p className="text-data mb-0.5 select-all text-micro text-muted-foreground/60">
              {project.reference}
            </p>
          ) : null}
          <h2 className={emphasis ? "font-display text-heading-2 font-bold" : "text-title"}>{project.name}</h2>
          {showOrganizations ? (
            <p className="mt-0.5 text-meta text-muted-foreground">{project.organizations.map((organization) => organization.name).join(" · ")}</p>
          ) : null}
        </div>

        {project.clientSummary ? (
          <p className={`${emphasis ? "max-w-[42rem] text-body-lg leading-relaxed" : "line-clamp-2 text-body"} text-muted-foreground`}>{project.clientSummary}</p>
        ) : null}

        {metaPreview ? (
          <div className="border-y border-border/55 py-3">
            <p className="text-micro font-semibold text-muted-foreground">{metaPreview.label}</p>
            <ul className="mt-2 space-y-1.5">
              {metaPreview.metas.map((meta) => (
                <li key={meta.id} className="flex items-center gap-2 text-body font-semibold">
                  <Flag aria-hidden className="size-3.5 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate">{meta.title}</span>
                  {meta.targetDate ? <span className="text-data text-micro font-normal text-muted-foreground">{formatClientProjectDate(meta.targetDate)}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-meta text-muted-foreground">
          <span
            className={`inline-flex items-center gap-1.5 ${overdue ? "font-semibold" : ""}`}
            style={overdue ? { color: "var(--project-health-off-track)" } : undefined}
          >
            <CalendarDays aria-hidden className="size-3.5 shrink-0" />
            <span className="text-data">{formatClientProjectDate(project.targetDate)}</span>
            {overdue ? <span className="text-micro">({clientProjectsDictionary.common.delayed})</span> : null}
          </span>

          <span className="inline-flex items-center gap-1.5">
            <Flag aria-hidden className="size-3.5 shrink-0" />
            {project.progress.percent !== null
              ? clientProjectsDictionary.safeUi.completedPercent(project.progress.percent)
              : dictionary.noMilestones}
          </span>
        </div>

        {milestoneProgressPct !== null ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-micro text-muted-foreground">
                {dictionary.milestoneProgress}
              </span>
              <span className="text-data text-micro font-bold text-primary">
                {milestoneProgressPct}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                style={{ width: `${milestoneProgressPct}%` }}
                className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
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
              <FolderKanban aria-hidden className="size-4 text-muted-foreground" />
              {dictionary.open}
            </span>
            <ArrowRight aria-hidden className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:transform-none" />
          </Link>
        </div>
      </div>
      </article>
    </Card>
  );
}
