export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { handleProjectsGetRequest } = await import("@brightweblabs/module-projects");
  return handleProjectsGetRequest(request);
}

export async function POST(request: Request) {
  const { handleProjectsPostRequest } = await import("@brightweblabs/module-projects");
  return handleProjectsPostRequest(request);
}
