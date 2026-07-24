"use client";

import { useParams } from "next/navigation";
import { ProjectBoardPage } from "@brightweblabs/module-projects/ui";
import { dashboard, mockProjectsClient } from "../../mock-data";

export default function ProjectBoardPreviewPage() {
  const { id } = useParams<{ id: string }>();
  return <ProjectBoardPage client={mockProjectsClient} initialData={{ ...dashboard, project: { ...dashboard.project, id } }} navigation={{ listHref: "/projects", detailHref: (projectId) => `/projects/${projectId}`, boardHref: (projectId) => `/projects/${projectId}/board` }} />;
}
