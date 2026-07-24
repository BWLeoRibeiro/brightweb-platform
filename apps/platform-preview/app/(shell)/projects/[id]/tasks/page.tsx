"use client";

import { useParams } from "next/navigation";
import { ProjectTasksPage } from "@brightweblabs/module-projects/ui";
import { dashboard, mockProjectsClient } from "../../mock-data";

export default function ProjectTasksPreviewPage() {
  const { id } = useParams<{ id: string }>();
  return <ProjectTasksPage client={mockProjectsClient} initialData={{ ...dashboard, project: { ...dashboard.project, id } }} navigation={{ listHref: "/projects", detailHref: (projectId) => `/projects/${projectId}`, boardHref: (projectId) => `/projects/${projectId}/tasks` }} />;
}
