import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, FolderKanban } from "lucide-react";
import { requireServerPageAccess } from "@brightweblabs/core-auth/server";
import { listAccountProjects } from "../../account-projects";
import type { ProjectHealth, ProjectListItem } from "../../data";
import {
  CLIENT_PROJECT_HEALTH_VAR,
  CLIENT_PROJECT_PREVIEW_HEALTH_LABELS,
  CLIENT_PROJECT_STATUS_LABELS,
  clientProjectsDictionary,
} from "./dictionary";
import {
  formatClientProjectDate,
  resolveClientProjectDetailHref,
} from "./shared";

export async function ClientProjectsPreview() {
  await connection();
  const { profileId, role, supabase } = await requireServerPageAccess();
  const isStaff = role === "staff" || role === "admin";
  const projectsHref = isStaff ? "/projects" : "/account/projetos";
  const projects = await listAccountProjects(supabase, profileId, { limit: 3 });
  const dictionary = clientProjectsDictionary.preview;
  const healthCounts = projects.items.reduce<Partial<Record<ProjectHealth, number>>>(
    (counts, project) => {
      counts[project.health] = (counts[project.health] ?? 0) + 1;
      return counts;
    },
    {},
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold">{dictionary.title}</h2>
          {projects.items.length > 0 ? (
            <div className="mt-1 flex flex-wrap items-center gap-3">
              {(Object.entries(healthCounts) as [ProjectHealth, number][]).map(
                ([health, count]) => (
                  <span
                    key={health}
                    className="inline-flex items-center gap-1 text-ui-label text-muted-foreground"
                  >
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ background: CLIENT_PROJECT_HEALTH_VAR[health] }}
                    />
                    {count} {CLIENT_PROJECT_PREVIEW_HEALTH_LABELS[health]}
                  </span>
                ),
              )}
            </div>
          ) : null}
        </div>
        <Link
          href={projectsHref}
          className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          {dictionary.fullList}
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {projects.schemaMissing ? (
        <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
          {dictionary.schemaMissing}
        </div>
      ) : null}

      {projects.error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {dictionary.loadError} {projects.error}
        </div>
      ) : null}

      {!projects.schemaMissing && !projects.error && projects.items.length === 0 ? (
        <div
          className="rounded-2xl border px-6 py-10 text-center"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          <FolderKanban className="mx-auto mb-3 size-9 text-muted-foreground/25" />
          <p className="text-sm font-semibold text-muted-foreground">{dictionary.empty}</p>
          <Link
            href={projectsHref}
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            {dictionary.explore} <ArrowRight className="size-3.5" />
          </Link>
        </div>
      ) : null}

      {projects.items.length > 0 ? (
        <div
          className="overflow-hidden rounded-2xl border"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          {projects.items.map((project, index) => (
            <ProjectRow
              key={project.id}
              project={project}
              isStaff={isStaff}
              isLast={index === projects.items.length - 1}
            />
          ))}

          <div
            className="flex items-center justify-between px-5 py-3"
            style={{
              borderTop: "1px solid var(--border)",
              background: "var(--muted)",
            }}
          >
            <span className="text-xs text-muted-foreground">{dictionary.showing}</span>
            <Link
              href={projectsHref}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              {dictionary.viewAll}
              <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ProjectRow({
  project,
  isStaff,
  isLast,
}: {
  project: ProjectListItem;
  isStaff: boolean;
  isLast: boolean;
}) {
  const healthVar = CLIENT_PROJECT_HEALTH_VAR[project.health];
  const progressPct =
    project.taskStats.total > 0
      ? Math.round((project.taskStats.done / project.taskStats.total) * 100)
      : null;

  return (
    <div
      className="relative flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/40 motion-reduce:transition-none"
      style={{ borderBottom: isLast ? "none" : "1px solid var(--border)" }}
    >
      <div
        className="absolute bottom-3 left-0 top-3 w-[3px] rounded-r-full"
        style={{ background: healthVar }}
      />

      <div className="min-w-0 flex-1 pl-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-ui-micro font-semibold"
            style={{
              background: "var(--muted)",
              color: "var(--muted-foreground)",
            }}
          >
            {CLIENT_PROJECT_STATUS_LABELS[project.status]}
          </span>
          <span
            className="inline-flex items-center gap-1 text-ui-micro font-semibold"
            style={{ color: healthVar }}
          >
            <span className="size-1.5 rounded-full" style={{ background: healthVar }} />
            {CLIENT_PROJECT_PREVIEW_HEALTH_LABELS[project.health]}
          </span>
        </div>

        <h3 className="truncate text-sm font-semibold leading-snug">{project.name}</h3>
        <p className="mt-0.5 text-ui-label text-muted-foreground">
          {project.organizationName}
          {project.targetDate ? ` · ${formatClientProjectDate(project.targetDate)}` : ""}
        </p>

        {progressPct !== null ? (
          <div className="mt-2 flex items-center gap-2">
            <div
              className="h-1 flex-1 overflow-hidden rounded-full"
              style={{ background: "var(--muted)" }}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${progressPct}%`, background: healthVar }}
              />
            </div>
            <span
              className="shrink-0 text-ui-micro font-bold tabular-nums"
              style={{ color: healthVar }}
            >
              {progressPct}%
            </span>
          </div>
        ) : null}
      </div>

      <Link
        href={resolveClientProjectDetailHref(isStaff, project.id)}
        className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline"
      >
        {clientProjectsDictionary.preview.open}
        <ArrowRight className="size-3" />
      </Link>
    </div>
  );
}
