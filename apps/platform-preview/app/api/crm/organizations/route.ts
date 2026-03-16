export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { handleCrmOrganizationsGetRequest } = await import("@brightweblabs/module-crm");
  return handleCrmOrganizationsGetRequest(request);
}
