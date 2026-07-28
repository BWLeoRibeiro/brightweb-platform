import { requireServerPageAccess } from "@brightweblabs/core-auth/server";
import { getProjectDashboard } from "@brightweblabs/module-projects";
import { ProjectBoardPageLiveMount } from "../../projects-live-mounts";

export default async function ProjectBoardPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireServerPageAccess();
  const initialData = await getProjectDashboard(supabase, id);

  return (
    <ProjectBoardPageLiveMount
      initialData={initialData}
      navigation={{
        listHref: "/projects",
        detailHrefPattern: "/projects/:projectId",
        boardHrefPattern: "/projects/:projectId/tasks",
      }}
    />
  );
}
