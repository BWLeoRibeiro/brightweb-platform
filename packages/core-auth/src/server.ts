import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import {
  createServerSupabase,
  requireServiceRoleClient,
} from "@brightweblabs/infra/server";
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
    profileId: string;
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

export type ProjectReadAccess =
  | {
    ok: true;
    supabase: Awaited<ReturnType<typeof createServerSupabase>>;
    user: User;
    profileId: string;
    role: GlobalRole;
  }
  | {
    ok: false;
    status: number;
    error: string;
  };

type ProjectReadAccessDependencies = {
  getAccess(): Promise<ServerUserAccess>;
  getServiceClient(): ReturnType<typeof requireServiceRoleClient>;
};

function projectReadQueryError(
  context: string,
  error: { code?: string; message?: string },
): Extract<ProjectReadAccess, { ok: false }> {
  console.error(`[core-auth.requireProjectReadAccess.${context}]`, {
    code: error.code,
    message: error.message,
  });
  return {
    ok: false,
    status: 503,
    error: "Não foi possível validar o acesso ao projeto.",
  };
}

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
    return profileError
      ? { ok: false, status: 503, error: profileError }
      : { ok: false, status: 409, error: "Perfil em falta." };
  }

  const { data: roleRaw, error: roleError } = await supabase.rpc("current_global_role");
  if (roleError) {
    console.error("[core-auth.requireServerUserAccess.role]", {
      userId: user.id,
      code: roleError.code,
      message: roleError.message,
    });
    return { ok: false, status: 503, error: "Não foi possível validar o acesso." };
  }
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
  profileId: string;
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
    profileId: access.profileId,
    role: access.role,
  };
}

export async function requireServerRoleAccess(allowedRoles: GlobalRole | GlobalRole[]): Promise<ServerRoleAccess> {
  const access = await requireServerUserAccess();
  if (!access.ok) {
    return access;
  }

  const { supabase, user, profileId, role } = access;

  if (!role) {
    return { ok: false, status: 403, error: "Acesso proibido." };
  }

  const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  if (!allowed.includes(role)) {
    return { ok: false, status: 403, error: "Acesso proibido." };
  }

  return { ok: true, supabase, user, profileId, role };
}

export function createProjectReadAccessGuard(
  dependencies: ProjectReadAccessDependencies,
): (projectId: string) => Promise<ProjectReadAccess> {
  return async function projectReadAccess(projectId: string): Promise<ProjectReadAccess> {
    const access = await dependencies.getAccess();
    if (!access.ok) {
      return access.status === 409
        ? { ok: false, status: 403, error: "Perfil não encontrado." }
        : access;
    }
    if (!access.role) {
      return { ok: false, status: 404, error: "Projeto não encontrado." };
    }
    if (access.role === "admin") {
      return { ...access, role: access.role };
    }

    if (access.role === "client") {
      const { data: canView, error: clientAccessError } = await access.supabase.rpc(
        "can_current_client_view_project",
        { target_project_id: projectId },
      );
      if (clientAccessError) return projectReadQueryError("clientAccess", clientAccessError);
      return canView === true
        ? { ...access, role: access.role }
        : { ok: false, status: 404, error: "Projeto não encontrado." };
    }

    const serviceSupabase = dependencies.getServiceClient();
    const { data: project, error: projectError } = await serviceSupabase
      .from("projects")
      .select("id, organization_id, owner_profile_id")
      .eq("id", projectId)
      .maybeSingle<{
        id: string;
        organization_id: string | null;
        owner_profile_id: string | null;
      }>();

    if (projectError) return projectReadQueryError("project", projectError);
    if (!project?.id) {
      return { ok: false, status: 404, error: "Projeto não encontrado." };
    }

    const { data: membership, error: membershipError } = await serviceSupabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("profile_id", access.profileId)
      .maybeSingle<{ role: string }>();

    if (membershipError) return projectReadQueryError("membership", membershipError);
    if (
      membership?.role === "owner"
      || membership?.role === "contributor"
      || membership?.role === "observer"
    ) {
      return { ...access, role: access.role };
    }

    if (project.owner_profile_id === access.profileId) {
      return { ...access, role: access.role };
    }

    if (project.organization_id) {
      const { data: organizationMembership, error: organizationMembershipError } = await serviceSupabase
        .from("organization_members")
        .select("role")
        .eq("organization_id", project.organization_id)
        .eq("profile_id", access.profileId)
        .maybeSingle<{ role: string }>();

      if (organizationMembershipError) {
        return projectReadQueryError("organizationMembership", organizationMembershipError);
      }
      if (organizationMembership?.role === "admin") {
        return { ...access, role: access.role };
      }
    }

    // Missing and forbidden projects intentionally share one response to prevent enumeration.
    return { ok: false, status: 404, error: "Projeto não encontrado." };
  };
}

export async function requireProjectReadAccess(projectId: string): Promise<ProjectReadAccess> {
  return createProjectReadAccessGuard({
    getAccess: requireServerUserAccess,
    getServiceClient: requireServiceRoleClient,
  })(projectId);
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

  if (error) {
    console.error("[core-auth.getProfileIdForUser]", {
      userId,
      code: error.code,
      message: error.message,
    });
    return { profileId: null, error: "Não foi possível carregar o perfil." };
  }

  return { profileId: profile?.id ?? null, error: null };
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
