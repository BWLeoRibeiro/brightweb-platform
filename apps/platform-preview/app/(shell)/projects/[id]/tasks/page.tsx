import { ProjectTasksRoutePage } from "@brightweblabs/module-projects/routes";

export default async function ProjectTasksPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProjectTasksRoutePage projectId={id} navigation={{ listHref: "/projects", detailHrefPattern: "/projects/:projectId", boardHrefPattern: "/projects/:projectId/tasks" }} />;
}
