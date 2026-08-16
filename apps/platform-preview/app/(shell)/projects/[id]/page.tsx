import { ProjectDetailRoutePage } from "@brightweblabs/module-projects/routes";

export default async function ProjectPreviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProjectDetailRoutePage projectId={id} navigation={{ listHref: "/projects", detailHrefPattern: "/projects/:projectId", boardHrefPattern: "/projects/:projectId/tasks" }} />;
}
