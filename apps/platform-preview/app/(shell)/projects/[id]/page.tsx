import { requireServerPageAccess } from "@brightweblabs/core-auth/server";
import { getProjectDashboard } from "@brightweblabs/module-projects";
import { ProjectDetailPageLiveMount } from "../projects-live-mounts";

export default async function ProjectPreviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireServerPageAccess();
  const initialData = await getProjectDashboard(supabase, id);

  return (
    <ProjectDetailPageLiveMount
      initialData={initialData}
      navigation={{
        listHref: "/projects",
        detailHref: (projectId) => `/projects/${projectId}`,
        boardHref: (projectId) => `/projects/${projectId}/tasks`,
      }}
    />
  );
}
