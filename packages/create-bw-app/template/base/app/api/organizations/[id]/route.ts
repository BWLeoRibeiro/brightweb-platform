export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { handleCrmOrganizationPatchRequest } = await import("@brightweblabs/module-crm");
  return handleCrmOrganizationPatchRequest(request, context);
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { handleOrganizationDeleteRequest } = await import("@brightweblabs/module-orgs");
  return handleOrganizationDeleteRequest(request, context);
}
