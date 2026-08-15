"use client";

import { ProjectEditHeaderButton } from "./project-edit-header-button";
import { useProjectDetailProject } from "./project-detail-data-provider";
import { ProjectStatusQuickAction } from "./project-status-quick-action";
import { ProjectStateBadge } from "./project-state-badge";
import { ProjectPill } from "./shared/project-pill";
import { ContactActionButtons } from "./shared/contact-action-buttons";
import { ProjectOwnerAvatar } from "./shared/project-owner-avatar";
import type { AvatarRoleColor } from "./shared/role-colors";
import { ProjectProgressBar, getCompletionPercent } from "./shared/project-progress";
import { PROJECT_RISK_META, resolveProjectRisk } from "./shared/project-risk";
import type { ProjectListItem } from "../types";
import { formatProjectDate, truncateProjectSummary } from "./shared/formatters";
import { ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useProjectsNavigation, useProjectsUiDictionary } from "./context";
import { useProjectsNow } from "./shared/use-projects-now";

type ProjectDetailHeroProps = {
  canOpenEditProject: boolean;
  canViewOrganization: boolean;
};

type ProjectHeroFactProps = {
  label: string;
  children: ReactNode;
  meta?: ReactNode;
  className?: string;
  /** When set, the leading icon slot is replaced by the person's initials avatar. */
  avatarLabel?: string | null;
  /** Role bucket that tints the avatar (e.g. "manager" for the gestor). */
  avatarRoleColor?: AvatarRoleColor | null;
};

const HERO_CONTACT_ICON_LINK_CLASS = "project-hero-contact-icon";
const HERO_NEUTRAL_ACTION_CLASS =
  "border-white/25 bg-white/10 text-white shadow-none hover:border-white/40 hover:bg-white/16 hover:text-white";

function ProjectHeroFact({ label, children, meta, className = "", avatarLabel, avatarRoleColor }: ProjectHeroFactProps) {
  return (
    <div className={`flex min-w-0 flex-row gap-x-2 ${className}`}>
      {avatarLabel ? (
        <ProjectOwnerAvatar label={avatarLabel} size="md" roleColor={avatarRoleColor} />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-meta font-semibold text-[color:var(--project-hero-subtle)]">{label}</p>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-body font-semibold leading-snug text-[color:var(--project-hero-foreground)]">
          {children}
        </div>
        {meta ? <div className="mt-0.5 text-meta leading-snug text-[color:var(--project-hero-muted)]">{meta}</div> : null}
      </div>
    </div>
  );
}

function ProjectHeroDate({
  label,
  value,
  tone,
  align = "start",
}: {
  label: string;
  value: string;
  tone?: string;
  align?: "start" | "end";
}) {
  return (
    <span className={`min-w-0 ${align === "end" ? "text-right" : "text-left"}`}>
      <span className="sr-only">
        {label}
      </span>
      <span className="text-data block whitespace-nowrap tabular-nums" style={tone ? { color: tone } : undefined}>
        {formatProjectDate(value)}
      </span>
    </span>
  );
}

function ProjectHeroActions({
  project,
  canOpenEditProject,
}: {
  project: ProjectListItem;
  canOpenEditProject: boolean;
}) {
  const now = useProjectsNow();
  const risk = resolveProjectRisk(project, now);
  const riskMeta = risk ? PROJECT_RISK_META[risk] : null;

  return (
    <div className="flex w-full items-center gap-2 md:w-auto md:justify-end md:self-start">
      {canOpenEditProject ? (
        <ProjectStatusQuickAction
          surface="hero"
        />
      ) : (
        <ProjectStateBadge.Status status={project.status} surface="hero" />
      )}
      {riskMeta ? (
        <ProjectPill
          size="normal"
          style={{
            color: riskMeta.var,
                ["--project-dynamic-risk" as string]: riskMeta.var,
            background: `var(--project-ui-color-02)`,
            borderColor: `var(--project-ui-color-03)`,
          }}
        >
          {riskMeta.label}
        </ProjectPill>
      ) : null}
      {canOpenEditProject ? <ProjectEditHeaderButton className={HERO_NEUTRAL_ACTION_CLASS} /> : null}
    </div>
  );
}

// Deep-links to the CRM dashboard and asks it to open the organization's
// read-only sheet on arrival (mirrors the "new contact/org" navbar actions).
function ViewOrganizationButton({ project }: { project: ProjectListItem }) {
  const router = useRouter();
  const navigation = useProjectsNavigation();
  const dictionary = useProjectsUiDictionary();
  return (
    <button
      type="button"
      onClick={() => {
        window.sessionStorage.setItem("dashboard:pending-action", "crm-view-organization");
        window.sessionStorage.setItem("dashboard:pending-org-id", project.organizationId);
        window.sessionStorage.setItem("dashboard:pending-org-name", project.organizationName ?? "");
        const href = navigation.organizationHref?.(project.organizationId);
        if (href) router.push(href);
      }}
      className="inline-flex items-center gap-1 text-meta font-semibold text-[color:var(--project-hero-muted)] underline-offset-2 transition-colors hover:text-[color:var(--project-hero-foreground)] hover:underline"
    >
      {dictionary.detail.viewOrganization}
      <ArrowUpRight className="size-3" />
    </button>
  );
}

function ProjectHeroFactGrid({
  project,
  projectReference,
  canViewOrganization,
}: {
  project: ProjectListItem;
  projectReference: string;
  canViewOrganization: boolean;
}) {
  const dictionary = useProjectsUiDictionary();
  const now = useProjectsNow();
  const completion = getCompletionPercent(project.taskStats.done, project.taskStats.total);
  const isComplete = completion >= 100;
  const risk = resolveProjectRisk(project, now);
  const deadlineTone = risk ? PROJECT_RISK_META[risk].var : undefined;
  const hasStartDate = Boolean(project.startDate);
  const hasTargetDate = Boolean(project.targetDate);
  const hasBothProjectDates = hasStartDate && hasTargetDate;
  const hasProjectDates = hasStartDate || hasTargetDate;

  return (
    <div className={`grid items-center gap-x-8 gap-y-5 sm:grid-cols-2 xl:gap-x-0 xl:divide-x xl:divide-[color:var(--project-hero-border)] ${hasProjectDates ? "xl:grid-cols-[0.95fr_0.95fr_1.45fr_1fr]" : "xl:grid-cols-[1fr_1fr_1.1fr]"}`}>
      <ProjectHeroFact className="xl:pr-8" label={dictionary.detail.projectManager} avatarLabel={project.ownerLabel} avatarRoleColor="manager">
        {project.ownerLabel ?? <span className="font-normal italic text-[color:var(--project-hero-muted)]">{dictionary.detail.unassigned}</span>}
        <ContactActionButtons
          label={project.ownerLabel}
          email={project.ownerEmail}
          phone={project.ownerPhone}
          projectName={project.name}
          projectReference={projectReference}
          linkClassName={HERO_CONTACT_ICON_LINK_CLASS}
        />
      </ProjectHeroFact>

      <ProjectHeroFact
        className="xl:px-8"
        label={dictionary.detail.organizationOwner}
        avatarLabel={project.organizationOwnerLabel}
        avatarRoleColor="client"
        meta={canViewOrganization ? <ViewOrganizationButton project={project} /> : null}
      >
        {project.organizationOwnerLabel ?? <span className="font-normal italic text-[color:var(--project-hero-muted)]">{dictionary.detail.notDefined}</span>}
        <ContactActionButtons
          label={project.organizationOwnerLabel}
          email={project.organizationOwnerEmail}
          phone={project.organizationOwnerPhone}
          projectName={project.name}
          projectReference={projectReference}
          linkClassName={HERO_CONTACT_ICON_LINK_CLASS}
        />
      </ProjectHeroFact>

      {hasStartDate || hasTargetDate ? (
        <ProjectHeroFact
          className="xl:px-8"
          label={hasBothProjectDates
            ? dictionary.detail.projectDates
            : hasStartDate
              ? dictionary.detail.projectStartDate
              : dictionary.detail.projectDueDate}
        >
          {hasBothProjectDates ? (
            <span className="grid w-full min-w-0 grid-cols-[auto_minmax(2.5rem,1fr)_auto] items-center gap-3">
              <ProjectHeroDate label={dictionary.detail.projectStartShort} value={project.startDate!} />
              <span
                aria-hidden="true"
                className="relative h-px bg-white/20 before:absolute before:left-0 before:top-1/2 before:size-1.5 before:-translate-y-1/2 before:rounded-full before:bg-white/50 after:absolute after:right-0 after:top-1/2 after:size-1.5 after:-translate-y-1/2 after:rounded-full after:bg-white/50"
              />
              <ProjectHeroDate label={dictionary.detail.projectEndShort} value={project.targetDate!} tone={deadlineTone} align="end" />
            </span>
          ) : (
            <span className="text-data tabular-nums" style={hasTargetDate && deadlineTone ? { color: deadlineTone } : undefined}>
              {formatProjectDate(hasStartDate ? project.startDate : project.targetDate)}
            </span>
          )}
        </ProjectHeroFact>
      ) : null}

      <ProjectHeroFact
        className="xl:pl-8"
        label={dictionary.detail.tasks}
        meta={project.taskStats.overdue > 0 ? `${project.taskStats.overdue} atrasada${project.taskStats.overdue !== 1 ? "s" : ""}` : null}
      >
        <span className="flex w-full items-center gap-3" title={dictionary.detail.completionTitle(completion)}>
          <ProjectProgressBar
            completed={project.taskStats.done}
            total={project.taskStats.total}
            className="flex-1 bg-white/15"
            fillClassName={isComplete ? "bg-[color:var(--project-state-active)]" : "bg-[color:var(--accent)]"}
          />
          <span className="text-data shrink-0 text-[color:var(--project-hero-foreground)]">
            {project.taskStats.done}/{project.taskStats.total}
          </span>
        </span>
      </ProjectHeroFact>
    </div>
  );
}

export function ProjectDetailHero({ canOpenEditProject, canViewOrganization }: ProjectDetailHeroProps) {
  const dictionary = useProjectsUiDictionary();
  const project = useProjectDetailProject();
  const isCanceledProject = project.status === "canceled";
  const summaryPreview = truncateProjectSummary(project.summary);
  const projectReference = project.code ?? project.id.slice(0, 8).toUpperCase();

  return (
    <div className="relative overflow-hidden bg-[var(--project-ui-color-08)] bg-[image:var(--project-hero-surface)] p-5 text-[color:var(--project-hero-foreground)] md:p-6">
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-data rounded-[var(--radius)] border border-[color:var(--project-hero-border)] bg-white/[0.06] px-1.5 py-0.5 text-micro font-semibold text-[color:var(--project-hero-muted)]">
                {projectReference}
              </span>
              <p className="truncate text-label font-semibold text-[color:var(--project-hero-muted)]">{project.organizationName}</p>
            </div>
            <h1
              className="text-heading-1 text-foreground text-[length:var(--text-ui-title-sm)] mt-2 [text-wrap:pretty] md:text-heading-1 text-[length:var(--text-ui-preview-card-title)]"
              style={{ color: "var(--project-hero-foreground)" }}
            >
              {project.name}
            </h1>
            <p className="mt-2 max-w-[82ch] text-title leading-relaxed text-[color:var(--project-hero-muted)] [text-wrap:pretty]" title={project.summary ?? undefined}>
              {summaryPreview}
            </p>
          </div>
          <ProjectHeroActions project={project} canOpenEditProject={canOpenEditProject} />
        </div>

        {isCanceledProject ? (
          <div className="mt-5 rounded-[var(--radius-card)] border border-[color:var(--project-ui-color-04)] bg-[color:var(--project-ui-color-05)] px-4 py-3">
            <p className="text-meta font-semibold text-[color:var(--project-ui-color-06)]">{dictionary.detail.cancellationReason}</p>
            <p className="mt-1 text-body text-[color:var(--project-ui-color-07)]">{project.cancellationReason ?? dictionary.detail.noCancellationReason}</p>
          </div>
        ) : null}

        <div className="mt-6 border-t border-[color:var(--project-hero-border)] pt-5">
          <ProjectHeroFactGrid project={project} projectReference={projectReference} canViewOrganization={canViewOrganization} />
        </div>
      </div>
    </div>
  );
}
