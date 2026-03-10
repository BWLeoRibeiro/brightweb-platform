import type { User } from "@supabase/supabase-js";
import { createServerSupabase } from "@brightweb/infra/server";

export type GlobalRole = "client" | "staff" | "admin";

type Profile = {
  id: string;
};

type ServerAccess = {
  user: User | null;
  profile: Profile | null;
  role: GlobalRole | null;
  isStaff: boolean;
  isAdmin: boolean;
  canAccessInsightsCms: boolean;
};

type ServerRoleAccess =
  | {
    ok: true;
    supabase: Awaited<ReturnType<typeof createServerSupabase>>;
    user: User;
    role: GlobalRole;
  }
  | {
    ok: false;
    status: number;
    error: string;
  };

const INSIGHTS_CMS_ALLOWED_ROLES: GlobalRole[] = ["admin"];
const DASHBOARD_LANDING_ROLES: GlobalRole[] = ["staff", "admin"];

export function normalizeGlobalRole(value: string | null | undefined): GlobalRole | null {
  const normalizedValue = (value ?? "").trim().toLowerCase();
  if (normalizedValue === "client" || normalizedValue === "staff" || normalizedValue === "admin") {
    return normalizedValue;
  }

  return null;
}

export function canAccessInsightsCms(role: string | null | undefined): boolean {
  const normalizedRole = normalizeGlobalRole(role);
  return normalizedRole !== null && INSIGHTS_CMS_ALLOWED_ROLES.some((allowedRole) => allowedRole === normalizedRole);
}

export function resolvePostLoginPath(role: string | null | undefined): "/dashboard" | "/account" {
  const normalizedRole = normalizeGlobalRole(role);
  const shouldLandOnDashboard = normalizedRole !== null
    && DASHBOARD_LANDING_ROLES.some((allowedRole) => allowedRole === normalizedRole);
  return shouldLandOnDashboard ? "/dashboard" : "/account";
}

export async function requireServerRoleAccess(allowedRoles: GlobalRole | GlobalRole[]): Promise<ServerRoleAccess> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, status: 401, error: "Não autorizado." };
  }

  const { data: roleRaw } = await supabase.rpc("current_global_role");
  const role = normalizeGlobalRole(typeof roleRaw === "string" ? roleRaw : null);

  if (!role) {
    return { ok: false, status: 403, error: "Acesso proibido." };
  }

  const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  if (!allowed.includes(role)) {
    return { ok: false, status: 403, error: "Acesso proibido." };
  }

  return { ok: true, supabase, user, role };
}

export async function getProfileIdForUser(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  userId: string,
): Promise<{ profileId: string | null; error: string | null }> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle<{ id: string }>();

  return {
    profileId: profile?.id ?? null,
    error: error?.message ?? null,
  };
}

export async function getServerAccess(): Promise<ServerAccess> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { user: null, profile: null, role: null, isStaff: false, isAdmin: false, canAccessInsightsCms: false };
  }

  const { profileId } = await getProfileIdForUser(supabase, user.id);

  const { data: roleValue } = await supabase.rpc("current_global_role");
  const role = normalizeGlobalRole(typeof roleValue === "string" ? roleValue : null);
  const isStaff = resolvePostLoginPath(role) === "/dashboard";
  const isAdmin = role === "admin";

  return {
    user,
    profile: profileId ? { id: profileId } : null,
    role,
    isStaff,
    isAdmin,
    canAccessInsightsCms: canAccessInsightsCms(role),
  };
}
