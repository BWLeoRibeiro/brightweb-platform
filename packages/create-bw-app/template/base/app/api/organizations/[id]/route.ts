export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { handleOrganizationPatchRequest } = await import("@brightweblabs/module-orgs");
  return handleOrganizationPatchRequest(request, context);
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { handleOrganizationDeleteRequest } = await import("@brightweblabs/module-orgs");
  return handleOrganizationDeleteRequest(request, context);
}
