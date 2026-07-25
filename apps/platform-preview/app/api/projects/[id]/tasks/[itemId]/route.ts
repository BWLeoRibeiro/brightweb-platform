export const dynamic = "force-dynamic";

type ProjectTaskRouteContext = {
  params: Promise<{ id: string; itemId: string }>;
};

export async function PATCH(request: Request, context: ProjectTaskRouteContext) {
  const { handleProjectsTasksPatchRequest } = await import("@brightweblabs/module-projects");
  return handleProjectsTasksPatchRequest(request, context);
}

export async function DELETE(request: Request, context: ProjectTaskRouteContext) {
  const { handleProjectsTasksDeleteRequest } = await import("@brightweblabs/module-projects");
  return handleProjectsTasksDeleteRequest(request, context);
}
