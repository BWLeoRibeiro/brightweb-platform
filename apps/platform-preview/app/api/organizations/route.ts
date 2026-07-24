export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { handleOrganizationsPostRequest } = await import("@brightweblabs/module-orgs");
  return handleOrganizationsPostRequest(request);
}
