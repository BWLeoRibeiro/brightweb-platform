export const dynamic = "force-dynamic";

type ProjectRouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: ProjectRouteContext) {
  const { handleProjectsDashboardGetRequest } = await import("@brightweblabs/module-projects");
  return handleProjectsDashboardGetRequest(request, context);
}

export async function PATCH(request: Request, context: ProjectRouteContext) {
  const { handleProjectsPatchRequest } = await import("@brightweblabs/module-projects");
  return handleProjectsPatchRequest(request, context);
}

export async function DELETE(request: Request, context: ProjectRouteContext) {
  const { handleProjectsDeleteRequest } = await import("@brightweblabs/module-projects");
  return handleProjectsDeleteRequest(request, context);
}
