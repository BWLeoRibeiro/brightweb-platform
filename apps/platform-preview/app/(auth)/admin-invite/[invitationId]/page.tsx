import { InvitePage } from "@brightweblabs/core-auth/ui";

export default async function Page({ params }: { params: Promise<{ invitationId: string }> }) {
  const { invitationId } = await params;
  return <InvitePage invitationId={invitationId} kind="admin" />;
}
