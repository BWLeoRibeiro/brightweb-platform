export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { handleCrmStatsGetRequest } = await import("@brightweblabs/module-crm");
  return handleCrmStatsGetRequest(request);
}
