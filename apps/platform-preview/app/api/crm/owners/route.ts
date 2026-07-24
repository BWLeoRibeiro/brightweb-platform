export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { handleCrmOwnersGetRequest } = await import("@brightweblabs/module-crm");
  return handleCrmOwnersGetRequest(request);
}
