export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { handleProjectsLinksPostRequest } = await import("@brightweblabs/module-projects");
  return handleProjectsLinksPostRequest(request, context);
}
