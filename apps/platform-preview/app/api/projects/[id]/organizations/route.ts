export const dynamic = "force-dynamic";

type ProjectRouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: ProjectRouteContext) {
  const { handleProjectOrganizationsPatchRequest } = await import("@brightweblabs/module-projects");
  return handleProjectOrganizationsPatchRequest(request, context);
}
