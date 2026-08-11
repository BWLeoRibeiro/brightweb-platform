export const dynamic = "force-dynamic";

type ProjectRouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: ProjectRouteContext) {
  const { handleProjectClientAccessGetRequest } = await import("@brightweblabs/module-projects");
  return handleProjectClientAccessGetRequest(request, context);
}

export async function PATCH(request: Request, context: ProjectRouteContext) {
  const { handleProjectClientAccessPatchRequest } = await import("@brightweblabs/module-projects");
  return handleProjectClientAccessPatchRequest(request, context);
}
