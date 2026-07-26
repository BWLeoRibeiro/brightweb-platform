export const dynamic = "force-dynamic";

type ProjectLinkRouteContext = {
  params: Promise<{ id: string; itemId: string }>;
};

export async function PATCH(request: Request, context: ProjectLinkRouteContext) {
  const { handleProjectsLinksPatchRequest } = await import("@brightweblabs/module-projects");
  return handleProjectsLinksPatchRequest(request, context);
}

export async function DELETE(request: Request, context: ProjectLinkRouteContext) {
  const { handleProjectsLinksDeleteRequest } = await import("@brightweblabs/module-projects");
  return handleProjectsLinksDeleteRequest(request, context);
}
