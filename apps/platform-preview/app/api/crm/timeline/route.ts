export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { handleCrmTimelineGetRequest } = await import("@brightweblabs/module-crm");
  return handleCrmTimelineGetRequest(request);
}
