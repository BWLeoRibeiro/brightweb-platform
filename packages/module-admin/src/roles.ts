import type { createServerSupabase } from "@brightweblabs/infra/server";
import { validateBoundedUuidBatch } from "@brightweblabs/infra/robustness";
import type { AdminManagedRole } from "./users";

export type RoleChangeResult = {
  profileId: string;
  oldRole: string | null;
  newRole: string;
  reason: string;
};

export type AdminRoleChangeSummary = {
  requested: number;
  changed: number;
  skipped: number;
};

export type AdminRoleChangeSkipped = {
  profileId: string;
  reason: string;
};

export type AdminRoleChangeResult = {
  changed: RoleChangeResult[];
  skipped: AdminRoleChangeSkipped[];
  summary: AdminRoleChangeSummary;
};

type ApplyAdminRoleChangesParams = {
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
  profileIds: string[];
  newRole: AdminManagedRole;
  reason: string;
};

export async function applyAdminRoleChanges({
  supabase,
  profileIds,
  newRole,
  reason,
}: ApplyAdminRoleChangesParams): Promise<AdminRoleChangeResult> {
  const batch = validateBoundedUuidBatch(profileIds);
  if (!batch.ok) throw new Error(batch.code);
  const uniqueProfileIds = batch.ids;
  const changed: RoleChangeResult[] = [];
  const skipped: AdminRoleChangeSkipped[] = [];

  for (const profileId of uniqueProfileIds) {
    const { data, error } = await supabase.rpc("admin_set_user_role", {
      p_target_profile_id: profileId,
      p_new_role_code: newRole,
      p_reason: reason,
    });

    if (error) {
      console.error("[admin.role-change]", { profileId, error });
      skipped.push({ profileId, reason: "role_update_failed" });
      continue;
    }

    const row = Array.isArray(data) ? data[0] : null;
    if (!row) {
      skipped.push({ profileId, reason: "sem_resultado" });
      continue;
    }

    const didChange = Boolean(row.changed);
    const resultReason = typeof row.reason === "string" ? row.reason : didChange ? "alterado" : "ignorado";

    if (!didChange) {
      skipped.push({ profileId, reason: resultReason });
      continue;
    }

    changed.push({
      profileId,
      oldRole: typeof row.old_role_code === "string" ? row.old_role_code : null,
      newRole: typeof row.new_role_code === "string" ? row.new_role_code : newRole,
      reason: resultReason,
    });
  }

  return {
    changed,
    skipped,
    summary: {
      requested: uniqueProfileIds.length,
      changed: changed.length,
      skipped: skipped.length,
    },
  };
}
