export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { handleOrganizationInvitationsGetRequest } = await import("@brightweblabs/module-orgs");
  return handleOrganizationInvitationsGetRequest(request, context);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { handleOrganizationInvitationsPostRequest } = await import("@brightweblabs/module-orgs");
  return handleOrganizationInvitationsPostRequest(request, context);
}
