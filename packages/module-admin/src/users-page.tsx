import { AdminUsersClient } from "./users-client";
import { getAdminUsersPageData } from "./users";
import "../tokens.css";

export async function AdminUsersPage() {
  const { users } = await getAdminUsersPageData();

  return <AdminUsersClient initialUsers={users} />;
}
