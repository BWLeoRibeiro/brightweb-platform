export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { handleCrmContactsGetRequest } = await import("@brightweblabs/module-crm");
  return handleCrmContactsGetRequest(request);
}

export async function POST(request: Request) {
  const { handleCrmContactsPostRequest } = await import("@brightweblabs/module-crm");
  return handleCrmContactsPostRequest(request);
}

export async function PATCH(request: Request) {
  const { handleCrmContactsPatchRequest } = await import("@brightweblabs/module-crm");
  return handleCrmContactsPatchRequest(request);
}

export async function DELETE(request: Request) {
  const { handleCrmContactsDeleteRequest } = await import("@brightweblabs/module-crm");
  return handleCrmContactsDeleteRequest(request);
}
