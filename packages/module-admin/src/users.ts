import { normalizeGlobalRole } from "@brightweblabs/core-auth/server";
import { createServerSupabase } from "@brightweblabs/infra/server";

export type AdminManagedRole = "client" | "staff" | "admin";

export const ADMIN_USERS_DEFAULT_PAGE_SIZE = 10;
export const ADMIN_USERS_MAX_PAGE_SIZE = 100;

export type AdminUserRow = {
  profileId: string;
  name: string;
  email: string;
  role: AdminManagedRole;
  createdAt: string;
  updatedAt: string | null;
};

export type AdminUsersPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AdminUsersListResult = {
  data: AdminUserRow[];
  pagination: AdminUsersPagination;
};

type ListAdminUsersParams = {
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  search?: string;
  roleFilter?: AdminManagedRole | null;
  page: number;
  pageSize: number;
};

export async function listAdminUsers({
  supabase,
  search = "",
  roleFilter = null,
  page,
  pageSize,
}: ListAdminUsersParams): Promise<AdminUsersListResult> {
  const normalizedSearch = search.trim().toLowerCase();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("user_role_assignments")
    .select(
      "profile_id, role_code, assigned_at, profile:profiles!user_role_assignments_profile_id_fkey(id, email, first_name, last_name, created_at, updated_at)",
      { count: "exact" },
    )
    .order("assigned_at", { ascending: false })
    .range(from, to);

  if (roleFilter) {
    query = query.eq("role_code", roleFilter);
  }

  if (normalizedSearch) {
    const escapedSearch = normalizedSearch.replace(/[%_,()"]/g, "");
    const filter = `%${escapedSearch}%`;
    query = query.or(`email.ilike.${filter},first_name.ilike.${filter},last_name.ilike.${filter}`, {
      foreignTable: "profiles",
    });
  }

  const { data: assignments, error: queryError, count } = await query;
  if (queryError) {
    throw new Error(queryError.message);
  }

  const data: AdminUserRow[] = (assignments ?? [])
    .map((assignment) => {
      if (typeof assignment.profile_id !== "string") {
        return null;
      }

      const role = normalizeGlobalRole(typeof assignment.role_code === "string" ? assignment.role_code : null);
      const profileRaw = assignment.profile;
      const profile = Array.isArray(profileRaw) ? profileRaw[0] ?? null : profileRaw ?? null;

      const email = profile?.email;
      const createdAt = profile?.created_at;
      if (!role || typeof email !== "string" || typeof createdAt !== "string") {
        return null;
      }

      const firstName = typeof profile.first_name === "string" ? profile.first_name.trim() : "";
      const lastName = typeof profile.last_name === "string" ? profile.last_name.trim() : "";
      const name = `${firstName} ${lastName}`.trim() || email;
      const updatedAt = typeof profile.updated_at === "string" ? profile.updated_at : null;

      return {
        profileId: assignment.profile_id,
        name,
        email,
        role,
        createdAt,
        updatedAt,
      } satisfies AdminUserRow;
    })
    .filter((row): row is AdminUserRow => row !== null);

  const total = count ?? 0;

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}
