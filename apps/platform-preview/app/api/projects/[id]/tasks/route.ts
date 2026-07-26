export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { handleProjectsTasksPostRequest } = await import("@brightweblabs/module-projects");
  return handleProjectsTasksPostRequest(request, context);
}
