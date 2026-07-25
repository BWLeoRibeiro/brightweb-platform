export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { handleProjectsOrganizationsGetRequest } = await import("@brightweblabs/module-projects");
  return handleProjectsOrganizationsGetRequest(request);
}

export async function POST(request: Request) {
  const { handleProjectsOrganizationsPostRequest } = await import("@brightweblabs/module-projects");
  return handleProjectsOrganizationsPostRequest(request);
}
