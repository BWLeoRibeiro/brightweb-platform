import { ProjectBoardRoutePage } from "@brightweblabs/module-projects/routes";

export default async function ProjectBoardPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProjectBoardRoutePage projectId={id} navigation={{ listHref: "/projects", detailHrefPattern: "/projects/:projectId", boardHrefPattern: "/projects/:projectId/tasks" }} />;
}
