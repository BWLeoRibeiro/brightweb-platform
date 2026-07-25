import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  Cloud,
  ExternalLink,
  FileText,
  Flag,
  Link2,
  Sheet,
  Users,
} from "lucide-react";
import { requireProjectReadAccess } from "@brightweblabs/core-auth/server";
import type { MilestoneStatus, ProjectLinkKind } from "../../contracts";
import {
  getClientProjectHealth,
  isProjectsSchemaMissingError,
  resolveProjectMemberColors,
} from "../../server";
import { getMemberDisplayLabel } from "../shared/member-role-badge";
import { avatarRoleClass } from "../shared/role-colors";
import {
  CLIENT_MILESTONE_STATUS_CLASSES,
  CLIENT_MILESTONE_STATUS_LABELS,
  CLIENT_PROJECT_HEALTH_LABELS,
  CLIENT_PROJECT_HEALTH_VAR,
  CLIENT_PROJECT_LINK_KIND_LABELS,
  CLIENT_PROJECT_STATUS_LABELS,
  CLIENT_PROJECT_STATUS_STYLES,
  clientProjectsDictionary,
} from "./dictionary";
import {
  formatClientProjectDate,
  isClientProjectDateOverdue,
} from "./shared";

const MILESTONE_STATUS_ICONS: Record<MilestoneStatus, ReactNode> = {
  pending: <Circle className="size-3.5 shrink-0" />,
  in_progress: <Clock className="size-3.5 shrink-0" />,
  achieved: <CheckCircle2 className="size-3.5 shrink-0" />,
  delayed: <AlertCircle className="size-3.5 shrink-0" />,
};

const LINK_KIND_ICONS: Record<ProjectLinkKind, ReactNode> = {
  doc: <FileText className="size-4 shrink-0" />,
  sheet: <Sheet className="size-4 shrink-0" />,
  drive: <Cloud className="size-4 shrink-0" />,
  other: <Link2 className="size-4 shrink-0" />,
};

function getInitials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts.at(-1)?.[0] ?? ""}`.toUpperCase();
}

function ErrorPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="client-projects-panel panel preview-glass-card">
      <div className="panel-inner space-y-4">
        <Link
          href="/account/projetos"
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="size-4" />
          {clientProjectsDictionary.detail.back}
        </Link>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {children}
      </div>
    </section>
  );
}

export async function ClientProjectDetailPage({
  projectId,
}: {
  projectId: string;
}) {
  await connection();
  const dictionary = clientProjectsDictionary.detail;
  const access = await requireProjectReadAccess(projectId);
  if (!access.ok) {
    if (access.status === 401) redirect("/login");
    return (
      <ErrorPage title={dictionary.noAccessTitle}>
        <p className="text-sm text-muted-foreground">{access.error}</p>
      </ErrorPage>
    );
  }

  let data: Awaited<ReturnType<typeof getClientProjectHealth>> | null = null;
  let loadError: string | null = null;
  let schemaMissing = false;

  try {
    data = await getClientProjectHealth(access.supabase, projectId);
  } catch (error) {
    if (isProjectsSchemaMissingError(error)) {
      schemaMissing = true;
    } else {
      loadError = error instanceof Error
        ? error.message
        : dictionary.unexpectedLoadError;
    }
  }

  if (schemaMissing) {
    return (
      <ErrorPage title={dictionary.moduleUnavailableTitle}>
        <p className="rounded-md border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-100">
          {dictionary.schemaMissing}
        </p>
      </ErrorPage>
    );
  }

  if (!data || loadError) {
    return (
      <ErrorPage title={dictionary.loadErrorTitle}>
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {loadError ?? dictionary.unexpectedDataError}
        </p>
      </ErrorPage>
    );
  }

  const project = data.project;
  const memberColorRoles = await resolveProjectMemberColors(
    access.supabase,
    data.members,
    project.ownerProfileId,
  );
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
  const sortedMilestones = [...data.milestones].sort((a, b) => {
    if (a.status === "achieved" && b.status !== "achieved") return 1;
    if (b.status === "achieved" && a.status !== "achieved") return -1;
    return (a.targetDate ?? "9999-12-31").localeCompare(
      b.targetDate ?? "9999-12-31",
    );
  });

  return (
    <section
      className="client-projects-panel panel preview-glass-card"
      style={{ borderTopColor: healthVar, borderTopWidth: "3px" }}
    >
      <div className="panel-inner space-y-6">
        <Link
          href="/account/projetos"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none"
        >
          <ArrowLeft className="size-4" />
          {dictionary.back}
        </Link>

        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-ui-label font-semibold ${CLIENT_PROJECT_STATUS_STYLES[project.status]}`}
            >
              {CLIENT_PROJECT_STATUS_LABELS[project.status]}
            </span>
            <span
              className="inline-flex items-center gap-1.5 text-ui-label font-semibold"
              style={{ color: healthVar }}
            >
              <span className="size-1.5 rounded-full" style={{ background: healthVar }} />
              {CLIENT_PROJECT_HEALTH_LABELS[project.health]}
            </span>
          </div>

          <div>
            {project.code ? (
              <p className="mb-0.5 select-all font-mono text-ui-label text-muted-foreground/60">
                {project.code}
              </p>
            ) : null}
            <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">{project.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{project.organizationName}</p>
          </div>

          {project.summary ? (
            <p className="max-w-[42rem] text-sm text-muted-foreground">{project.summary}</p>
          ) : null}
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            icon={<CalendarDays className="size-4" />}
            label={dictionary.projectDeadline}
            value={formatClientProjectDate(project.targetDate)}
            accent={overdue ? "var(--project-health-off-track)" : undefined}
            note={overdue ? clientProjectsDictionary.common.delayed : undefined}
          />

          <StatCard
            icon={<Flag className="size-4" />}
            label={dictionary.milestonesCompleted}
            value={
              project.milestoneStats.total > 0
                ? `${project.milestoneStats.achieved} / ${project.milestoneStats.total}`
                : "—"
            }
            note={
              project.milestoneStats.delayed > 0
                ? dictionary.delayedMilestones(project.milestoneStats.delayed)
                : milestoneProgressPct !== null
                  ? dictionary.completedMilestones(milestoneProgressPct)
                  : undefined
            }
            accent={
              project.milestoneStats.delayed > 0
                ? "var(--project-health-off-track)"
                : undefined
            }
            progress={
              milestoneProgressPct !== null
                ? { pct: milestoneProgressPct, color: healthVar }
                : undefined
            }
          />

          <StatCard
            icon={<AlertCircle className="size-4" />}
            label={dictionary.nextDelivery}
            value={data.nextMilestone ? data.nextMilestone.title : "—"}
            note={
              data.nextMilestone?.targetDate
                ? formatClientProjectDate(data.nextMilestone.targetDate)
                : undefined
            }
            accent={
              data.nextMilestone
              && isClientProjectDateOverdue(data.nextMilestone.targetDate)
                ? "var(--project-health-off-track)"
                : undefined
            }
          />
        </div>

        {sortedMilestones.length > 0 ? (
          <section className="space-y-3">
            <SectionHeading icon={<Flag className="size-4" />}>
              {dictionary.milestonesTitle}
            </SectionHeading>
            <ol className="space-y-2">
              {sortedMilestones.map((milestone) => {
                const statusClassName = CLIENT_MILESTONE_STATUS_CLASSES[milestone.status];
                const milestoneOverdue =
                  isClientProjectDateOverdue(milestone.targetDate)
                  && milestone.status !== "achieved";
                return (
                  <li
                    key={milestone.id}
                    className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/50 px-3.5 py-3"
                  >
                    <span className={`mt-0.5 ${statusClassName}`}>
                      {MILESTONE_STATUS_ICONS[milestone.status]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-semibold leading-snug ${
                          milestone.status === "achieved"
                            ? "text-muted-foreground line-through"
                            : ""
                        }`}
                      >
                        {milestone.title}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <span className={statusClassName}>
                          {CLIENT_MILESTONE_STATUS_LABELS[milestone.status]}
                        </span>
                        {milestone.targetDate ? (
                          <>
                            <span className="text-muted-foreground/40">·</span>
                            <span
                              style={
                                milestoneOverdue
                                  ? { color: "var(--project-health-off-track)" }
                                  : undefined
                              }
                            >
                              {milestone.completedAt
                                ? dictionary.completedOn(
                                  formatClientProjectDate(milestone.completedAt),
                                )
                                : formatClientProjectDate(milestone.targetDate)}
                              {milestoneOverdue ? dictionary.delayedSuffix : ""}
                            </span>
                          </>
                        ) : null}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}

        <section className="space-y-3">
          <SectionHeading icon={<Link2 className="size-4" />}>
            {dictionary.linksTitle}
          </SectionHeading>
          {data.links.length === 0 ? (
            <p className="text-sm text-muted-foreground">{dictionary.linksEmpty}</p>
          ) : (
            <ul className="space-y-2">
              {data.links.map((link) => (
                <li key={link.id}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center gap-3 rounded-lg border border-border/60 bg-background/50 px-3.5 py-3 transition-[color,background-color,border-color] hover:border-border hover:bg-background/80 motion-reduce:transition-none"
                  >
                    <span className="text-muted-foreground">
                      {LINK_KIND_ICONS[link.kind]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold leading-snug text-primary group-hover:underline">
                        {link.label}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {CLIENT_PROJECT_LINK_KIND_LABELS[link.kind]}
                      </span>
                    </span>
                    <ExternalLink className="size-3.5 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        {data.members.length > 0 ? (
          <section className="space-y-3">
            <SectionHeading icon={<Users className="size-4" />}>
              {dictionary.membersTitle}
            </SectionHeading>
            <ul className="flex flex-wrap gap-2">
              {data.members.map((member) => {
                const colorRole = memberColorRoles[member.profileId] ?? null;
                const content = (
                  <>
                    <span
                      className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full text-ui-label font-bold ${avatarRoleClass(colorRole)}`}
                    >
                      {getInitials(member.label)}
                    </span>
                    <div className="min-w-0 max-w-48">
                      <p className="truncate text-sm font-semibold leading-none">
                        {member.label}
                      </p>
                      <p className="mt-0.5 truncate text-ui-label text-muted-foreground">
                        {getMemberDisplayLabel(member.role, colorRole)}
                        {member.email ? ` · ${member.email}` : ""}
                      </p>
                    </div>
                  </>
                );

                return (
                  <li key={member.id}>
                    {member.email ? (
                      <a
                        href={`mailto:${member.email}`}
                        className="group flex items-center gap-2.5 rounded-lg border border-border/60 bg-background/50 px-3 py-2 transition-[color,background-color,border-color] hover:border-border hover:bg-background/80 motion-reduce:transition-none"
                      >
                        {content}
                      </a>
                    ) : (
                      <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-background/50 px-3 py-2">
                        {content}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </section>
  );
}

function SectionHeading({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      {icon}
      {children}
    </h2>
  );
}

function StatCard({
  icon,
  label,
  value,
  note,
  accent,
  progress,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note?: string;
  accent?: string;
  progress?: { pct: number; color: string };
}) {
  return (
    <div className="space-y-1.5 rounded-xl border border-border/60 bg-background/60 px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span style={accent ? { color: accent } : undefined}>{icon}</span>
        {label}
      </div>
      <p
        className="text-base font-semibold leading-none tabular-nums"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </p>
      {progress ? (
        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full"
            style={{ width: `${progress.pct}%`, background: progress.color }}
          />
        </div>
      ) : null}
      {note ? (
        <p
          className="text-ui-micro leading-none"
          style={
            accent
              ? { color: accent }
              : { color: "var(--muted-foreground)" }
          }
        >
          {note}
        </p>
      ) : null}
    </div>
  );
}
