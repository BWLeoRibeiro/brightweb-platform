import { InvitePage } from "@brightweblabs/core-auth/ui";

export async function InviteRouteMount({
  params,
}: {
  params: Promise<{ invitationId: string }>;
}) {
  const { invitationId } = await params;
  return <InvitePage invitationId={invitationId} />;
}
