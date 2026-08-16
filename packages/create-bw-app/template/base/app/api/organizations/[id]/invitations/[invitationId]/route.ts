export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; invitationId: string }> },
) {
  const { handleOrganizationInvitationResendRequest } = await import("@brightweblabs/module-orgs");
  return handleOrganizationInvitationResendRequest(request, context);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; invitationId: string }> },
) {
  const { handleOrganizationInvitationDeleteRequest } = await import("@brightweblabs/module-orgs");
  return handleOrganizationInvitationDeleteRequest(request, context);
}
