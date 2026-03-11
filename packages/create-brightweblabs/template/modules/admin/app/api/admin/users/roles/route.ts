export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { handleAdminUsersRoleChangeRequest } = await import("@brightweblabs/module-admin");
  return handleAdminUsersRoleChangeRequest(request);
}
