export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { handleProjectsActivityGetRequest } = await import("@brightweblabs/module-projects");
  return handleProjectsActivityGetRequest(request, context);
}
