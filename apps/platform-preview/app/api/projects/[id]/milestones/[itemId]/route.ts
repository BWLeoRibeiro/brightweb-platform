export const dynamic = "force-dynamic";

type ProjectMilestoneRouteContext = {
  params: Promise<{ id: string; itemId: string }>;
};

export async function PATCH(request: Request, context: ProjectMilestoneRouteContext) {
  const { handleProjectsMilestonesPatchRequest } = await import("@brightweblabs/module-projects");
  return handleProjectsMilestonesPatchRequest(request, context);
}

export async function DELETE(request: Request, context: ProjectMilestoneRouteContext) {
  const { handleProjectsMilestonesDeleteRequest } = await import("@brightweblabs/module-projects");
  return handleProjectsMilestonesDeleteRequest(request, context);
}
