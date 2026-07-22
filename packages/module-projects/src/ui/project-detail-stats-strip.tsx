import {
  ProjectOverviewStatCard,
  ProjectOverviewStatMeta,
  ProjectOverviewStatValue,
} from "./shared/project-overview-stat-card";
import { ContactActionButtons } from "./shared/contact-action-buttons";
import type { ProjectListItem } from "../types";
import { formatProjectDate } from "./shared/formatters";
import { useProjectsUiDictionary } from "./context";

type ProjectDetailStatsStripProps = {
  project: ProjectListItem;
};

const CONTACT_ICON_LINK_CLASS =
  "project-contact-icon";

export function ProjectDetailStatsStrip({ project }: ProjectDetailStatsStripProps) {
  const dictionary = useProjectsUiDictionary();
  return (
    <div className="grid grid-cols-2 border-t border-border-hairline xl:grid-cols-4">
      <ProjectOverviewStatCard
        title={dictionary.detail.projectManager}
        className="project-stat-cell border-r border-border-hairline"
        contentClassName="flex items-center gap-2"
      >
        <span className="text-[15px] font-semibold leading-snug tracking-tight text-[color:var(--foreground)]">{project.ownerLabel ?? <span className="font-normal italic text-[color:var(--muted-foreground)]">{dictionary.detail.unassigned}</span>}</span>
        <ContactActionButtons
          label={project.ownerLabel}
          email={project.ownerEmail}
          phone={project.ownerPhone}
          projectName={project.name}
          projectReference={project.code ?? project.id}
          linkClassName={CONTACT_ICON_LINK_CLASS}
        />
      </ProjectOverviewStatCard>

      <ProjectOverviewStatCard
        title={dictionary.detail.organizationOwnerLong}
        className="project-stat-cell border-border-hairline xl:border-r"
        contentClassName="mt-2"
      >
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold leading-snug tracking-tight text-[color:var(--foreground)]">{project.organizationOwnerLabel ?? <span className="font-normal italic text-[color:var(--muted-foreground)]">{dictionary.detail.notDefined}</span>}</span>
          <ContactActionButtons
            label={project.organizationOwnerLabel}
            email={project.organizationOwnerEmail}
            phone={project.organizationOwnerPhone}
            projectName={project.name}
            projectReference={project.code ?? project.id}
            linkClassName={CONTACT_ICON_LINK_CLASS}
          />
        </div>
        {project.organizationOwnerLabel ? <ProjectOverviewStatMeta>{dictionary.detail.organizationRecord}</ProjectOverviewStatMeta> : null}
      </ProjectOverviewStatCard>

      <ProjectOverviewStatCard
        title={dictionary.detail.projectDueDate}
        className="project-stat-cell border-t border-r border-border-hairline xl:border-t-0"
      >
        <ProjectOverviewStatValue>{formatProjectDate(project.targetDate)}</ProjectOverviewStatValue>
      </ProjectOverviewStatCard>

      <ProjectOverviewStatCard
        title={dictionary.detail.tasks}
        className="project-stat-cell border-t border-border-hairline xl:border-t-0"
      >
        <ProjectOverviewStatValue>{project.taskStats.done}/{project.taskStats.total} {dictionary.detail.completedTasksLowercase}</ProjectOverviewStatValue>
        {project.taskStats.overdue > 0 ? (
        <ProjectOverviewStatMeta className="font-semibold text-[var(--project-health-off-track-strong)] dark:text-[var(--project-health-off-track-soft)]">
          {project.taskStats.overdue} {project.taskStats.overdue === 1 ? dictionary.detail.overdueTask : dictionary.detail.overdueTasks}
        </ProjectOverviewStatMeta>
        ) : null}
      </ProjectOverviewStatCard>
    </div>
  );
}
