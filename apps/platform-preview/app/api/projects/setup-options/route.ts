export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { handleProjectsSetupOptionsGetRequest } = await import("@brightweblabs/module-projects");
  return handleProjectsSetupOptionsGetRequest(request);
}
