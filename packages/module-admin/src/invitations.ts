import type { SupabaseClient } from "@supabase/supabase-js";
import { sendAdminUserInviteEmail } from "./invite-email";

const ADMIN_USER_INVITE_EXPIRY_DAYS = 14;
export const ADMIN_USER_INVITE_EMAIL_DELIVERY_ERROR =
  "Não foi possível enviar o email de convite. O convite não foi guardado. Verifique a configuração do Resend.";
export const ADMIN_USER_INVITE_SCHEMA_MISSING_ERROR =
  "A tabela de convites de utilizadores ainda não existe na base de dados. Aplique a migration admin_user_invitations.";

export type AdminInviteRole = "staff" | "admin";
export type AdminUserInvitation = {
  id: string;
  email: string;
  role: AdminInviteRole;
  status: "pending" | "accepted" | "revoked" | "expired";
  createdAt: string;
  expiresAt: string;
  invitedByProfileId: string | null;
  acceptedAt: string | null;
  acceptedByProfileId: string | null;
  revokedAt: string | null;
};

export type AdminUserInvitationDetails = {
  id: string;
  invitedEmail: string;
  role: AdminInviteRole;
  status: AdminUserInvitation["status"];
  expiresAt: string;
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeRole(value: unknown): AdminInviteRole {
  return value === "admin" ? "admin" : "staff";
}

function normalizeStatus(value: unknown): AdminUserInvitation["status"] {
  return value === "accepted" || value === "revoked" || value === "expired" ? value : "pending";
}

function normalizeInvitation(raw: Record<string, unknown>): AdminUserInvitation {
  return {
    id: String(raw.id),
    email: typeof raw.invited_email === "string" ? normalizeEmail(raw.invited_email) : "",
    role: normalizeRole(raw.role_code),
    status: normalizeStatus(raw.status),
    createdAt: String(raw.created_at),
    expiresAt: String(raw.expires_at),
    invitedByProfileId: typeof raw.invited_by_profile_id === "string" ? raw.invited_by_profile_id : null,
    acceptedAt: typeof raw.accepted_at === "string" ? raw.accepted_at : null,
    acceptedByProfileId: typeof raw.accepted_by_profile_id === "string" ? raw.accepted_by_profile_id : null,
    revokedAt: typeof raw.revoked_at === "string" ? raw.revoked_at : null,
  };
}

function isMissingSchemaError(error: { code?: string; message?: string } | null): boolean {
  return error?.code === "42P01" || (error?.message ?? "").toLowerCase().includes("admin_user_invitations");
}

function throwInviteError(error: { code?: string; message?: string } | null): never {
  if (isMissingSchemaError(error)) throw new Error(ADMIN_USER_INVITE_SCHEMA_MISSING_ERROR);
  throw new Error(error?.message ?? "Erro ao aceder aos convites de utilizadores.");
}

function isInvitationExpired(expiresAt: string): boolean {
  const date = new Date(expiresAt);
  return Number.isNaN(date.getTime()) || date.getTime() < Date.now();
}

function isExistingAccountError(error: { message?: string } | null): boolean {
  const message = (error?.message ?? "").toLowerCase();
  return message.includes("already") || message.includes("exists") || message.includes("registered");
}

async function logAdminInvitationEvent(
  supabase: SupabaseClient,
  input: {
    actorProfileId: string | null;
    invitationId: string;
    eventType: string;
    summary: string;
    payload: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await supabase.rpc("log_app_activity_event", {
    p_domain: "admin",
    p_event_type: input.eventType,
    p_entity_table: "admin_user_invitations",
    p_entity_id: input.invitationId,
    p_summary: input.summary,
    p_payload: input.payload,
    p_actor_profile_id: input.actorProfileId,
  });
  if (error) console.error("Error logging admin invitation event:", error);
}

async function findAuthUserIdByEmail(supabase: SupabaseClient, email: string): Promise<string | null> {
  const target = normalizeEmail(email);
  const perPage = 1000;
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const match = data.users.find((user) => normalizeEmail(user.email ?? "") === target);
    if (match?.id) return match.id;
    if (data.users.length < perPage) return null;
  }
  return null;
}

async function ensureInvitationProfile(
  supabase: SupabaseClient,
  params: { userId: string; email: string; firstName: string; lastName: string },
): Promise<{ id: string }> {
  const { error: syncError } = await supabase.rpc("sync_profile_from_auth_identity", {
    p_user_id: params.userId,
    p_email: params.email,
    p_metadata: { first_name: params.firstName || null, last_name: params.lastName || null },
  });
  if (syncError) throw new Error(syncError.message);
  const { data, error } = await supabase.from("profiles").select("id")
    .eq("user_id", params.userId).maybeSingle<{ id: string }>();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Não foi possível criar o perfil.");
  return data;
}

async function assignInvitedUserRole(
  supabase: SupabaseClient,
  params: { profileId: string; role: AdminInviteRole; invitedByProfileId: string | null },
): Promise<void> {
  const { data: current, error } = await supabase.from("user_role_assignments").select("role_code")
    .eq("profile_id", params.profileId).maybeSingle<{ role_code: string | null }>();
  if (error) throw new Error(error.message);
  const { error: upsertError } = await supabase.from("user_role_assignments").upsert({
    profile_id: params.profileId,
    role_code: params.role,
    assigned_by_profile_id: params.invitedByProfileId,
    assigned_at: new Date().toISOString(),
    reason: "Convite de utilizador do portal aceite.",
  }, { onConflict: "profile_id" });
  if (upsertError) throw new Error(upsertError.message);
  if (params.invitedByProfileId) {
    const { error: auditError } = await supabase.from("role_change_audit").insert({
      target_profile_id: params.profileId,
      changed_by_profile_id: params.invitedByProfileId,
      old_role_code: current?.role_code ?? null,
      new_role_code: params.role,
      reason: "Convite de utilizador do portal aceite.",
    });
    if (auditError) throw new Error(auditError.message);
  }
}

export async function listAdminUserInvitations(supabase: SupabaseClient): Promise<AdminUserInvitation[]> {
  const { data, error } = await supabase.from("admin_user_invitations")
    .select("id, invited_email, role_code, status, invited_by_profile_id, accepted_by_profile_id, accepted_at, revoked_at, expires_at, created_at")
    .order("created_at", { ascending: false }).limit(50);
  if (error) throwInviteError(error);
  return ((data ?? []) as Array<Record<string, unknown>>).map(normalizeInvitation);
}

export async function getAdminUserInvitationDetails(
  supabase: SupabaseClient,
  invitationId: string,
): Promise<AdminUserInvitationDetails | null> {
  const { data, error } = await supabase.from("admin_user_invitations")
    .select("id, invited_email, role_code, status, expires_at")
    .eq("id", invitationId).maybeSingle<Record<string, unknown>>();
  if (error) throwInviteError(error);
  if (!data) return null;
  return {
    id: String(data.id),
    invitedEmail: typeof data.invited_email === "string" ? normalizeEmail(data.invited_email) : "",
    role: normalizeRole(data.role_code),
    status: normalizeStatus(data.status),
    expiresAt: String(data.expires_at),
  };
}

export async function createAdminUserInvitation(
  supabase: SupabaseClient,
  params: { email: string; role: AdminInviteRole; invitedByProfileId: string },
): Promise<AdminUserInvitation> {
  const email = normalizeEmail(params.email);
  if (!email) throw new Error("EMAIL_REQUIRED");
  if (await findAuthUserIdByEmail(supabase, email)) throw new Error("ACCOUNT_ALREADY_EXISTS");
  const { data, error } = await supabase.from("admin_user_invitations").insert({
    invited_email: email,
    role_code: params.role,
    invited_by_profile_id: params.invitedByProfileId,
    expires_at: new Date(Date.now() + ADMIN_USER_INVITE_EXPIRY_DAYS * 86_400_000).toISOString(),
  }).select("id, invited_email, role_code, status, invited_by_profile_id, accepted_by_profile_id, accepted_at, revoked_at, expires_at, created_at")
    .single<Record<string, unknown>>();
  if (error) {
    if (error.code === "23505") throw new Error("PENDING_INVITATION_EXISTS");
    throwInviteError(error);
  }
  const invitation = normalizeInvitation(data);
  const delivered = await sendAdminUserInviteEmail({
    invitationId: invitation.id,
    invitedEmail: invitation.email,
    role: invitation.role,
  });
  if (!delivered) {
    await supabase.from("admin_user_invitations").delete().eq("id", invitation.id);
    throw new Error(ADMIN_USER_INVITE_EMAIL_DELIVERY_ERROR);
  }
  await logAdminInvitationEvent(supabase, {
    actorProfileId: params.invitedByProfileId,
    invitationId: invitation.id,
    eventType: "admin_user_invitation_created",
    summary: `Convite enviado para ${invitation.email}.`,
    payload: { email: invitation.email, role: invitation.role, status: invitation.status },
  });
  return invitation;
}

export async function revokeAdminUserInvitation(
  supabase: SupabaseClient,
  invitationId: string,
  options: { revokedByProfileId?: string | null } = {},
): Promise<void> {
  const { error } = await supabase.from("admin_user_invitations")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", invitationId).eq("status", "pending");
  if (error) throwInviteError(error);
  await logAdminInvitationEvent(supabase, {
    actorProfileId: options.revokedByProfileId ?? null,
    invitationId,
    eventType: "admin_user_invitation_revoked",
    summary: "Convite de utilizador revogado.",
    payload: { status: "revoked" },
  });
}

export async function registerUserFromAdminInvitation(
  supabase: SupabaseClient,
  params: { invitationId: string; firstName: string; lastName: string; password: string },
): Promise<{ email: string; role: AdminInviteRole }> {
  const invitation = await getAdminUserInvitationDetails(supabase, params.invitationId);
  if (!invitation) throw new Error("INVITATION_NOT_FOUND");
  if (invitation.status !== "pending") throw new Error("INVITATION_NOT_AVAILABLE");
  if (isInvitationExpired(invitation.expiresAt)) {
    const { error } = await supabase.from("admin_user_invitations")
      .update({ status: "expired" }).eq("id", invitation.id).eq("status", "pending");
    if (error) throwInviteError(error);
    await logAdminInvitationEvent(supabase, {
      actorProfileId: null,
      invitationId: invitation.id,
      eventType: "admin_user_invitation_expired",
      summary: `Convite expirado para ${invitation.invitedEmail}.`,
      payload: { email: invitation.invitedEmail, role: invitation.role, status: "expired" },
    });
    throw new Error("INVITATION_EXPIRED");
  }
  const firstName = params.firstName.trim();
  const lastName = params.lastName.trim();
  const { data, error } = await supabase.auth.admin.createUser({
    email: invitation.invitedEmail,
    password: params.password,
    email_confirm: true,
    user_metadata: { first_name: firstName || null, last_name: lastName || null },
  });
  let userId = data.user?.id ?? null;
  let createdUserId = userId;
  if (error) {
    if (!isExistingAccountError(error)) throw new Error(error.message);
    userId = await findAuthUserIdByEmail(supabase, invitation.invitedEmail);
    if (!userId) throw new Error("ACCOUNT_ALREADY_EXISTS");
    createdUserId = null;
  }
  if (!userId) throw new Error("Não foi possível criar utilizador.");
  try {
    const profile = await ensureInvitationProfile(supabase, {
      userId,
      email: invitation.invitedEmail,
      firstName,
      lastName,
    });
    const { data: row, error: rowError } = await supabase.from("admin_user_invitations")
      .select("invited_by_profile_id").eq("id", invitation.id)
      .single<{ invited_by_profile_id: string | null }>();
    if (rowError) throwInviteError(rowError);
    await assignInvitedUserRole(supabase, {
      profileId: profile.id,
      role: invitation.role,
      invitedByProfileId: row.invited_by_profile_id,
    });
    const { error: updateError } = await supabase.from("admin_user_invitations").update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_by_profile_id: profile.id,
    }).eq("id", invitation.id).eq("status", "pending");
    if (updateError) throwInviteError(updateError);
    await logAdminInvitationEvent(supabase, {
      actorProfileId: profile.id,
      invitationId: invitation.id,
      eventType: "admin_user_invitation_accepted",
      summary: `Convite aceite por ${invitation.invitedEmail}.`,
      payload: {
        email: invitation.invitedEmail,
        role: invitation.role,
        status: "accepted",
        accepted_by_profile_id: profile.id,
      },
    });
  } catch (caught) {
    if (createdUserId) await supabase.auth.admin.deleteUser(createdUserId);
    throw caught;
  }
  return { email: invitation.invitedEmail, role: invitation.role };
}
