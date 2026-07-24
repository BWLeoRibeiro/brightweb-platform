import type { User } from "@supabase/supabase-js";
import { requireServerUserAccess } from "@brightweblabs/core-auth/server";
import { requireServiceRoleClient } from "@brightweblabs/infra/server";
import type { GlobalRole } from "@brightweblabs/core-auth/shared";

type OrganizationBaseAccess = {
  serviceSupabase: ReturnType<typeof requireServiceRoleClient>;
  user: User;
  role: GlobalRole;
  profileId: string;
};

type OrganizationAccessError = {
  ok: false;
  status: number;
  error: string;
};

async function resolveBaseOrganizationAccess(): Promise<OrganizationBaseAccess | OrganizationAccessError> {
  const access = await requireServerUserAccess();
  if (!access.ok) {
    return access.status === 409
      ? { ok: false, status: 403, error: "Perfil não encontrado." }
      : access;
  }
  if (!access.role) return { ok: false, status: 403, error: "Acesso proibido." };

  return {
    serviceSupabase: requireServiceRoleClient(),
    user: access.user,
    role: access.role,
    profileId: access.profileId,
  };
}

function isAccessError(
  access: OrganizationBaseAccess | OrganizationAccessError,
): access is OrganizationAccessError {
  return "ok" in access && access.ok === false;
}

export async function requireOrganizationsStaffAccess() {
  const base = await resolveBaseOrganizationAccess();
  if (isAccessError(base)) return base;
  if (base.role !== "admin" && base.role !== "staff") {
    return { ok: false, status: 403, error: "Acesso proibido." } as const;
  }
  return { ok: true, ...base } as const;
}

export async function requireOrganizationManageAccess(organizationId: string) {
  const base = await resolveBaseOrganizationAccess();
  if (isAccessError(base)) return base;
  if (base.role === "admin" || base.role === "staff") {
    return { ok: true, ...base, isOrgMember: true, isOrgAdmin: true } as const;
  }

  const { data, error } = await base.serviceSupabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("profile_id", base.profileId)
    .maybeSingle<{ role: string }>();
  if (error) return { ok: false, status: 500, error: error.message } as const;
  if (data?.role !== "admin") return { ok: false, status: 403, error: "Acesso proibido." } as const;
  return { ok: true, ...base, isOrgMember: true, isOrgAdmin: true } as const;
}
