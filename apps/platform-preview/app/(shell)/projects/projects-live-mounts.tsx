"use client";

import {
  ProjectBoardPage,
  ProjectDetailPage,
  ProjectsPage,
  ProjectTasksPage,
  type ProjectDetailPageProps,
  type ProjectsPageProps,
  type ProjectTasksPageProps,
} from "@brightweblabs/module-projects/ui";

export function ProjectsPageLiveMount(props: ProjectsPageProps) {
  return <ProjectsPage {...props} />;
}

export function ProjectDetailPageLiveMount(props: ProjectDetailPageProps) {
  return <ProjectDetailPage {...props} />;
}

export function ProjectBoardPageLiveMount(props: ProjectTasksPageProps) {
  return <ProjectBoardPage {...props} />;
}

export function ProjectTasksPageLiveMount(props: ProjectTasksPageProps) {
  return <ProjectTasksPage {...props} />;
}
