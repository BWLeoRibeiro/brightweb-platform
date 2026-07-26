export const dynamic = "force-dynamic";

type ProjectMembersRouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: ProjectMembersRouteContext) {
  const { handleProjectsAssignableProfilesGetRequest } = await import("@brightweblabs/module-projects");
  return handleProjectsAssignableProfilesGetRequest(request, context);
}

export async function PUT(request: Request, context: ProjectMembersRouteContext) {
  const { handleProjectsMembersPutRequest } = await import("@brightweblabs/module-projects");
  return handleProjectsMembersPutRequest(request, context);
}
