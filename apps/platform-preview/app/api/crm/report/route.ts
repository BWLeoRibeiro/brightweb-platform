export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { handleCrmReportGetRequest } = await import("@brightweblabs/module-crm");
  return handleCrmReportGetRequest(request);
}
