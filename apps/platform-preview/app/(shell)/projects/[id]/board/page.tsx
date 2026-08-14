import { requireServerPageRoleAccess } from "@brightweblabs/core-auth/server";
import { getProjectAccess, getProjectDashboard } from "@brightweblabs/module-projects";
import { ProjectBoardPageLiveMount } from "../../projects-live-mounts";

export default async function ProjectBoardPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, profileId, role } = await requireServerPageRoleAccess(["admin", "staff"]);
  const [initialData, access] = await Promise.all([
    getProjectDashboard(supabase, id),
    getProjectAccess(supabase, id, profileId, role),
  ]);

  return (
    <ProjectBoardPageLiveMount
      initialData={initialData}
      projectRole={access.projectRole}
      permissions={access.permissions}
      navigation={{
        listHref: "/projects",
        detailHrefPattern: "/projects/:projectId",
        boardHrefPattern: "/projects/:projectId/tasks",
      }}
    />
  );
}
