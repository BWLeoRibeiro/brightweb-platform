"use client";

import type { ProjectDashboardData } from "../types";
import { ProjectsUiProvider } from "./context";
import { defaultProjectsUiDictionary } from "./dictionary";
import { ProjectBoardKanban } from "./project-board-kanban";
import { ProjectDetailCreateSheetsMount } from "./project-detail-create-sheets/project-detail-create-sheets-mount";
import { ProjectDetailDataProvider } from "./project-detail-data-provider";
import { ProjectEditSheetLazy } from "./project-lazy-panels";
import type { ProjectsNavigationConfig, ProjectsUiClient, ProjectsUiDictionary } from "./types";

export type ProjectTasksPermissions = { canEditProjectItems: boolean; canCreateProjectLinks: boolean; canOpenEditProject: boolean };

export type ProjectTasksPageProps = {
  client?: ProjectsUiClient;
  initialData: ProjectDashboardData;
  permissions?: Partial<ProjectTasksPermissions>;
  dictionary?: ProjectsUiDictionary;
  navigation?: Partial<ProjectsNavigationConfig>;
};

const DEFAULT_PERMISSIONS: ProjectTasksPermissions = { canEditProjectItems: true, canCreateProjectLinks: true, canOpenEditProject: true };

export function ProjectTasksPage({ client, initialData, permissions, dictionary = defaultProjectsUiDictionary, navigation }: ProjectTasksPageProps) {
  const access = { ...DEFAULT_PERMISSIONS, ...permissions };
  return (
    <ProjectsUiProvider client={client} dictionary={dictionary} navigation={navigation}>
      <ProjectDetailDataProvider initialData={initialData}>
        <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-6">
          <ProjectBoardKanban canEditItems={access.canEditProjectItems} />
          {access.canOpenEditProject ? <ProjectEditSheetLazy projectId={initialData.project.id} /> : null}
          <ProjectDetailCreateSheetsMount projectId={initialData.project.id} canCreateMilestonesAndTasks={access.canEditProjectItems} canCreateLinks={access.canCreateProjectLinks} />
        </div>
      </ProjectDetailDataProvider>
    </ProjectsUiProvider>
  );
}

export const ProjectBoardPage = ProjectTasksPage;
export default ProjectTasksPage;
