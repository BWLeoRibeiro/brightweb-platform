export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { handleCrmOrganizationsPostRequest } = await import("@brightweblabs/module-crm");
  return handleCrmOrganizationsPostRequest(request);
}
