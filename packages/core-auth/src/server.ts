import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@brightweblabs/infra/server";
import {
  canAccessInsightsCms,
  normalizeGlobalRole,
  resolvePostLoginPath,
  type GlobalRole,
} from "./shared";

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

type ServerUserAccess =
  | {
    ok: true;
    supabase: Awaited<ReturnType<typeof createServerSupabase>>;
    user: User;
    profileId: string;
    role: GlobalRole | null;
  }
  | {
    ok: false;
    status: number;
    error: string;
  };

export async function requireServerUserAccess(): Promise<ServerUserAccess> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, status: 401, error: "Não autorizado." };
  }

  const { profileId, error: profileError } = await getProfileIdForUser(supabase, user.id);
  if (!profileId) {
    return { ok: false, status: 409, error: profileError ?? "Perfil em falta." };
  }

  const { data: roleRaw } = await supabase.rpc("current_global_role");
  const role = normalizeGlobalRole(typeof roleRaw === "string" ? roleRaw : null);

  return { ok: true, supabase, user, profileId, role };
}

export async function requireServerPageAccess(): Promise<{
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  user: User;
  profileId: string;
  role: GlobalRole | null;
}> {
  const access = await requireServerUserAccess();

  if (!access.ok) {
    if (access.status === 401) {
      redirect("/login");
    }

    if (access.status === 409) {
      redirect("/account");
    }

    throw new Error(access.error);
  }

  return access;
}

export async function requireServerPageRoleAccess(
  allowedRoles: GlobalRole | GlobalRole[],
): Promise<{
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  user: User;
  role: GlobalRole;
}> {
  const access = await requireServerUserAccess();

  if (!access.ok) {
    if (access.status === 401) {
      redirect("/login");
    }

    if (access.status === 409) {
      redirect("/account");
    }

    throw new Error(access.error);
  }

  const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  if (!access.role || !allowed.includes(access.role)) {
    redirect(resolvePostLoginPath(access.role));
  }

  return {
    supabase: access.supabase,
    user: access.user,
    role: access.role,
  };
}

export async function requireServerRoleAccess(allowedRoles: GlobalRole | GlobalRole[]): Promise<ServerRoleAccess> {
  const access = await requireServerUserAccess();
  if (!access.ok) {
    return access;
  }

  const { supabase, user, role } = access;

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
