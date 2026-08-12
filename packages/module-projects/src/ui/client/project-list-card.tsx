import Link from "next/link";
import { ArrowRight, CalendarDays, Flag } from "lucide-react";
import { Card } from "@brightweblabs/ui";
import type { ClientProjectListItem } from "../../client-contracts";
import {
  CLIENT_PROJECT_STATUS_LABELS,
  clientProjectsDictionary,
} from "./dictionary";
import {
  formatClientProjectDate,
  isClientProjectDateOverdue,
  resolveClientMetaPreview,
  resolveClientProjectDetailHref,
} from "./shared";
import { ProjectStatusBadge } from "../project-state-badge";
import { ProjectProgressBar } from "../shared/project-progress";

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
    <Card asChild variant={emphasis ? "elevated" : "light"}>
      <article className={`group relative overflow-hidden border-border/65 bg-background/75 transition-[border-color,background-color,box-shadow] focus-within:ring-2 focus-within:ring-ring hover:border-border hover:bg-background hover:shadow-[var(--dashboard-shadow-md)] motion-reduce:transition-none ${emphasis ? "before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-[color:var(--brand-accent)]" : ""}`}>
        <div className={`flex flex-1 flex-col gap-4 ${emphasis ? "p-6 sm:p-8" : "p-5"}`}>
        <div className="flex items-center">
          <ProjectStatusBadge status={project.status} label={CLIENT_PROJECT_STATUS_LABELS[project.status]} size="small" />
        </div>

        <div>
          {project.reference ? (
            <p className="text-data mb-0.5 text-micro text-muted-foreground/60">
              {project.reference}
            </p>
          ) : null}
          <h2 className={emphasis ? "font-display text-[length:var(--text-ui-dashboard-title)] font-black leading-[var(--type-leading-110)] tracking-[var(--type-tracking-n025)]" : "text-title"}>
            <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none">
              {project.name}
            </Link>
          </h2>
          {showOrganizations ? (
            <p className="mt-0.5 text-meta text-muted-foreground">{project.organizations.map((organization) => organization.name).join(" · ")}</p>
          ) : null}
        </div>

        {project.clientSummary ? (
          <p className={`${emphasis ? "max-w-[42rem] text-body-lg leading-relaxed" : "line-clamp-2 text-body"} text-muted-foreground`}>{project.clientSummary}</p>
        ) : null}

        {metaPreview ? (
          <div className={`border-t border-border/55 ${emphasis ? "my-1 pt-4" : "pt-3"}`}>
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

        <div className="mt-auto space-y-3 border-t border-border/55 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-meta text-muted-foreground">
            <span
              className={`inline-flex items-center gap-1.5 ${overdue ? "font-semibold" : ""}`}
              style={overdue ? { color: "var(--project-health-off-track)" } : undefined}
            >
              <CalendarDays aria-hidden className="size-3.5 shrink-0" />
              <span className="text-data">{formatClientProjectDate(project.targetDate)}</span>
              {overdue ? <span className="text-micro">({clientProjectsDictionary.common.delayed})</span> : null}
            </span>
            {milestoneProgressPct !== null && milestoneProgressPct > 0 ? (
              <span className="text-data text-micro font-bold text-primary">
                {clientProjectsDictionary.safeUi.completedPercent(milestoneProgressPct)}
              </span>
            ) : null}
          </div>

          {milestoneProgressPct !== null && milestoneProgressPct > 0 ? (
            <ProjectProgressBar ariaLabel={dictionary.milestoneProgress} percent={milestoneProgressPct} trackClassName="bg-muted" fillClassName="bg-primary motion-reduce:transition-none" />
          ) : null}

          <span aria-hidden className="inline-flex items-center gap-2 text-body font-semibold text-primary">
            {dictionary.open}
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:transform-none" />
          </span>
        </div>
      </div>
      </article>
    </Card>
  );
}
