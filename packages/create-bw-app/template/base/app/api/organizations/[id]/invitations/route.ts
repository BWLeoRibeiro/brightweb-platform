export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { handleOrganizationInvitationsGetRequest } = await import("@brightweblabs/module-orgs");
  return handleOrganizationInvitationsGetRequest(request, context);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { handleCrmOrganizationInvitationsPostRequest } = await import("@brightweblabs/module-crm");
  return handleCrmOrganizationInvitationsPostRequest(request, context);
}
