export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { handleProjectsMilestonesPostRequest } = await import("@brightweblabs/module-projects");
  return handleProjectsMilestonesPostRequest(request, context);
}
