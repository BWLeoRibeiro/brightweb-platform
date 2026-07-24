export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; invitationId: string }> },
) {
  const { handleOrganizationInvitationDeleteRequest } = await import("@brightweblabs/module-orgs");
  return handleOrganizationInvitationDeleteRequest(request, context);
}
