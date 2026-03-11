export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { handleAdminUsersGetRequest } = await import("@brightweblabs/module-admin");
  return handleAdminUsersGetRequest(request);
}
