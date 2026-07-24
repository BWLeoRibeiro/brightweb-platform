export const dynamic = "force-dynamic";

export async function GET() {
  const { handleAdminUserInvitationsGetRequest } = await import("@brightweblabs/module-admin");
  return handleAdminUserInvitationsGetRequest();
}

export async function POST(request: Request) {
  const { handleAdminUserInvitationsPostRequest } = await import("@brightweblabs/module-admin");
  return handleAdminUserInvitationsPostRequest(request);
}
