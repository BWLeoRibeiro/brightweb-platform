export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { handleProjectsStatsGetRequest } = await import("@brightweblabs/module-projects");
  return handleProjectsStatsGetRequest(request);
}
