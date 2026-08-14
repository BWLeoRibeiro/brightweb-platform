export const dynamic = "force-dynamic";

type ProjectRouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: ProjectRouteContext) {
  const { handleClientProjectDetailGetRequest } = await import("@brightweblabs/module-projects");
  return handleClientProjectDetailGetRequest(request, context);
}
