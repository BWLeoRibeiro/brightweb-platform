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

export type OrganizationAccessDependencies = {
  getAccess: typeof requireServerUserAccess;
  getServiceClient: typeof requireServiceRoleClient;
};

const defaultOrganizationAccessDependencies: OrganizationAccessDependencies = {
  getAccess: requireServerUserAccess,
  getServiceClient: requireServiceRoleClient,
};

async function resolveBaseOrganizationAccess(
  dependencies: OrganizationAccessDependencies,
): Promise<OrganizationBaseAccess | OrganizationAccessError> {
  const access = await dependencies.getAccess();
  if (!access.ok) {
    return access.status === 409
      ? { ok: false, status: 403, error: "Perfil não encontrado." }
      : access;
  }
  if (!access.role) return { ok: false, status: 403, error: "Acesso proibido." };

  return {
    serviceSupabase: dependencies.getServiceClient(),
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

export function createOrganizationsStaffAccessGuard(
  dependencies: OrganizationAccessDependencies,
) {
  return async function organizationsStaffAccess() {
    const base = await resolveBaseOrganizationAccess(dependencies);
    if (isAccessError(base)) return base;
    if (base.role !== "admin" && base.role !== "staff") {
      return { ok: false, status: 403, error: "Acesso proibido." } as const;
    }
    return { ok: true, ...base } as const;
  };
}

export function createOrganizationManageAccessGuard(
  dependencies: OrganizationAccessDependencies,
) {
  return async function organizationManageAccess(_organizationId: string) {
    const base = await resolveBaseOrganizationAccess(dependencies);
    if (isAccessError(base)) return base;
    if (base.role !== "admin" && base.role !== "staff") {
      return { ok: false, status: 403, error: "Acesso proibido." } as const;
    }
    return { ok: true, ...base } as const;
  };
}

export async function requireOrganizationsStaffAccess() {
  return createOrganizationsStaffAccessGuard(defaultOrganizationAccessDependencies)();
}

export async function requireOrganizationManageAccess(organizationId: string) {
  return createOrganizationManageAccessGuard(defaultOrganizationAccessDependencies)(organizationId);
}
