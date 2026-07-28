import { requireServerPageAccess } from "@brightweblabs/core-auth/server";
import { getProjectDashboard } from "@brightweblabs/module-projects";
import { ProjectTasksPageLiveMount } from "../../projects-live-mounts";

export default async function ProjectTasksPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireServerPageAccess();
  const initialData = await getProjectDashboard(supabase, id);

  return (
    <ProjectTasksPageLiveMount
      initialData={initialData}
      navigation={{
        listHref: "/projects",
        detailHrefPattern: "/projects/:projectId",
        boardHrefPattern: "/projects/:projectId/tasks",
      }}
    />
  );
}
