"use client";

import { Suspense } from "react";
import type { ProjectDashboardData } from "../types";
import { ProjectsUiProvider } from "./context";
import { defaultProjectsUiDictionary } from "./dictionary";
import { ProjectActivityCard } from "./project-activity-card";
import { ProjectDetailCreateSheetsMount } from "./project-detail-create-sheets/project-detail-create-sheets-mount";
import { ProjectDetailDataProvider } from "./project-detail-data-provider";
import { ProjectMilestonesAndTasksCards } from "./project-detail-editable-cards";
import { ProjectDetailHero } from "./project-detail-hero";
import { ProjectDetailMetadataStrip } from "./project-detail-metadata-strip";
import { ProjectDetailTeamCard } from "./project-detail-team-card";
import { ProjectEditSheetLazy } from "./project-lazy-panels";
import { ProjectLinksCard } from "./project-links-card";
import type { RoleColor } from "./shared/role-colors";
import { CompactCollectionCardSkeleton } from "./shared/compact-collection-skeleton";
import type { ProjectDetailPermissions, ProjectDetailSlots, ProjectsNavigationConfig, ProjectsUiClient, ProjectsUiDictionary } from "./types";

const DEFAULT_PERMISSIONS: ProjectDetailPermissions = { canOpenEditProject: true, canEditProjectItems: false, canCreateProjectLinks: false, canManageProjectLinks: false, canManageMembers: false, canViewOrganization: true };

export type ProjectDetailPageProps = {
  client?: ProjectsUiClient;
  initialData: ProjectDashboardData;
  permissions?: Partial<ProjectDetailPermissions>;
  projectRole?: "admin" | "owner" | "contributor" | "observer";
  memberColorRoles?: Record<string, RoleColor>;
  dictionary?: ProjectsUiDictionary;
  navigation?: Partial<ProjectsNavigationConfig>;
  slots?: ProjectDetailSlots;
};

function LowerCardFallback() { return <CompactCollectionCardSkeleton />; }

export function ProjectDetailPage({ client, initialData, permissions, projectRole = "observer", memberColorRoles = {}, dictionary = defaultProjectsUiDictionary, navigation, slots }: ProjectDetailPageProps) {
  const access = { ...DEFAULT_PERMISSIONS, ...permissions };
  return <ProjectsUiProvider client={client} dictionary={dictionary} navigation={navigation}>
    <ProjectDetailDataProvider initialData={initialData}>
      <div className="mx-auto flex w-full max-w-[1260px] flex-col gap-lg pb-lg pt-0 md:pb-xl">
        <section className="dashboard-reveal w-full min-w-0 self-stretch overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--project-hero-border)] bg-[color:var(--project-hero-base)] bg-[image:var(--project-hero-surface)] shadow-[var(--project-hero-shadow)]">
          <ProjectDetailHero canOpenEditProject={access.canOpenEditProject} canViewOrganization={access.canViewOrganization} />
        </section>
        {slots?.afterHero}
        <section className="grid items-stretch gap-lg xl:grid-cols-3"><ProjectMilestonesAndTasksCards projectId={initialData.project.id} canEditItems={access.canEditProjectItems} /></section>
        <section className="grid items-start gap-lg xl:grid-cols-3">
          <Suspense fallback={<LowerCardFallback />}><ProjectLinksCard projectId={initialData.project.id} canCreateItems={access.canCreateProjectLinks} canManageItems={access.canManageProjectLinks} /></Suspense>
          <Suspense fallback={<LowerCardFallback />}><ProjectDetailTeamCard canManageMembers={access.canManageMembers} memberColorRoles={memberColorRoles} /></Suspense>
          <Suspense fallback={<LowerCardFallback />}><ProjectActivityCard projectId={initialData.project.id} initialActivity={initialData.activity} initialActivityTotal={initialData.activityTotal} /></Suspense>
        </section>
        {slots?.beforeMetadata}
        <ProjectDetailMetadataStrip />
        <ProjectEditSheetLazy projectId={initialData.project.id} projectRole={projectRole} />
        <ProjectDetailCreateSheetsMount projectId={initialData.project.id} canCreateMilestonesAndTasks={access.canEditProjectItems} canCreateLinks={access.canCreateProjectLinks} />
      </div>
    </ProjectDetailDataProvider>
  </ProjectsUiProvider>;
}

export default ProjectDetailPage;
