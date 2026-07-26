export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { handleAccountGetRequest } = await import("@brightweblabs/core-auth");
  return handleAccountGetRequest(request);
}

export async function PATCH(request: Request) {
  const { handleAccountUpdateRequest } = await import("@brightweblabs/core-auth");
  return handleAccountUpdateRequest(request);
}
