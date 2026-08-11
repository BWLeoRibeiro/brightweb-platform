import { requireServerPageRoleAccess } from "@brightweblabs/core-auth/server";
import { getProjectAccess, getProjectDashboard } from "@brightweblabs/module-projects";
import { ProjectTasksPageLiveMount } from "../../projects-live-mounts";

export default async function ProjectTasksPreviewPage({
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
    <ProjectTasksPageLiveMount
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
