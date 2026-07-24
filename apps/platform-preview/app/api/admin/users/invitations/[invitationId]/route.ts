export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ invitationId: string }> },
) {
  const { handleAdminUserInvitationDeleteRequest } = await import("@brightweblabs/module-admin");
  return handleAdminUserInvitationDeleteRequest(request, context);
}
