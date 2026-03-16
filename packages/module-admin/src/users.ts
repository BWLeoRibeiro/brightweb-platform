import { requireServerPageRoleAccess } from "@brightweblabs/core-auth/server";
export {
  ADMIN_USERS_DEFAULT_PAGE_SIZE,
  ADMIN_USERS_MAX_PAGE_SIZE,
  listAdminUsers,
  type AdminManagedRole,
  type AdminUserRow,
  type AdminUsersListResult,
  type AdminUsersPageData,
  type AdminUsersPagination,
} from "./users-data.ts";
import { ADMIN_USERS_DEFAULT_PAGE_SIZE, listAdminUsers, type AdminUsersPageData } from "./users-data.ts";

export async function getAdminUsersPageData(): Promise<AdminUsersPageData> {
  const { supabase } = await requireServerPageRoleAccess("admin");
  const users = await listAdminUsers({
    supabase,
    search: "",
    roleFilter: null,
    page: 1,
    pageSize: ADMIN_USERS_DEFAULT_PAGE_SIZE,
  });

  return { users };
}
