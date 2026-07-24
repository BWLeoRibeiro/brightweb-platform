import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrganizationMemberRole } from "./data";
import { sendOrganizationInviteEmail } from "./invite-email";

const INVITE_EXPIRY_DAYS = 14;
export const ORGANIZATION_INVITE_EMAIL_DELIVERY_ERROR =
  "Não foi possível enviar o email de convite. O convite não foi guardado. Verifique a configuração do Resend.";

export type OrganizationInviteDraft = {
  email: string;
  role: OrganizationMemberRole;
};

export type OrganizationInvitation = {
  id: string;
  organizationId: string;
  email: string;
  role: OrganizationMemberRole;
  status: "pending" | "accepted" | "revoked" | "expired";
  createdAt: string;
  expiresAt: string;
  invitedByProfileId: string | null;
  acceptedAt: string | null;
  acceptedByProfileId: string | null;
  acceptedContactId: string | null;
  revokedAt: string | null;
};

export type OrganizationInvitationDetails = {
  id: string;
  organizationId: string;
  organizationName: string;
  invitedEmail: string;
  role: OrganizationMemberRole;
  status: OrganizationInvitation["status"];
  expiresAt: string;
};

export type OrganizationInviteSummary = {
  pendingInvitations: number;
  directAssignments: number;
  updatedExistingMembers: number;
  unchangedExistingMembers: number;
  failedEmailDeliveries: number;
};

export type OrganizationMemberView = {
  id: string;
  profileId: string;
  role: OrganizationMemberRole;
  joinedAt: string;
  label: string;
  email: string | null;
};

export type EnsureCrmContact = (
  profileId: string,
  options: { source: string; serviceClient: SupabaseClient },
) => Promise<{ success: boolean; contactId?: string; error?: string }>;

export async function logOrganizationActivity(
  supabase: SupabaseClient,
  input: {
    actorProfileId: string | null;
    organizationId: string;
    eventType: string;
    summary: string;
    payload: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await supabase.rpc("log_app_activity_event", {
    p_domain: "crm",
    p_event_type: input.eventType,
    p_entity_table: "organizations",
    p_entity_id: input.organizationId,
    p_summary: input.summary,
    p_payload: input.payload,
    p_actor_profile_id: input.actorProfileId,
  });
  if (error) console.error("Error logging organization activity event:", error);
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeStatus(value: unknown): OrganizationInvitation["status"] {
  return value === "accepted" || value === "revoked" || value === "expired" ? value : "pending";
}

function normalizeInvitation(raw: Record<string, unknown>): OrganizationInvitation {
  return {
    id: String(raw.id),
    organizationId: String(raw.organization_id),
    email: typeof raw.invited_email === "string" ? normalizeEmail(raw.invited_email) : "",
    role: raw.role === "admin" ? "admin" : "member",
    status: normalizeStatus(raw.status),
    createdAt: String(raw.created_at),
    expiresAt: String(raw.expires_at),
    invitedByProfileId: typeof raw.invited_by_profile_id === "string" ? raw.invited_by_profile_id : null,
    acceptedAt: typeof raw.accepted_at === "string" ? raw.accepted_at : null,
    acceptedByProfileId: typeof raw.accepted_by_profile_id === "string" ? raw.accepted_by_profile_id : null,
    acceptedContactId: typeof raw.accepted_contact_id === "string" ? raw.accepted_contact_id : null,
    revokedAt: typeof raw.revoked_at === "string" ? raw.revoked_at : null,
  };
}

function isInvitationExpired(expiresAt: string): boolean {
  const date = new Date(expiresAt);
  return Number.isNaN(date.getTime()) || date.getTime() < Date.now();
}

function isExistingAccountError(error: { message?: string } | null): boolean {
  const message = (error?.message ?? "").toLowerCase();
  return message.includes("already") || message.includes("exists") || message.includes("registered");
}

async function syncOrganizationPrimaryContactFromAdmins(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("profile_id")
    .eq("organization_id", organizationId)
    .eq("role", "admin")
    .order("joined_at", { ascending: true })
    .limit(1);
  if (error) throw new Error(error.message);
  const { error: updateError } = await supabase
    .from("organizations")
    .update({ primary_contact_id: typeof data?.[0]?.profile_id === "string" ? data[0].profile_id : null })
    .eq("id", organizationId);
  if (updateError) throw new Error(updateError.message);
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
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", params.userId)
    .maybeSingle<{ id: string }>();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Não foi possível criar o perfil.");
  return data;
}

export async function getOrganizationInvitationDetails(
  supabase: SupabaseClient,
  invitationId: string,
): Promise<OrganizationInvitationDetails | null> {
  const { data, error } = await supabase
    .from("organization_invitations")
    .select("id, organization_id, invited_email, role, status, expires_at, organizations(name)")
    .eq("id", invitationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const raw = data as unknown as Record<string, unknown>;
  const organizationRaw = raw.organizations;
  const organization = Array.isArray(organizationRaw) ? organizationRaw[0] ?? null : organizationRaw;
  return {
    id: String(raw.id),
    organizationId: String(raw.organization_id),
    organizationName:
      organization && typeof organization === "object" && typeof (organization as { name?: unknown }).name === "string"
        ? (organization as { name: string }).name
        : "Organização",
    invitedEmail: typeof raw.invited_email === "string" ? normalizeEmail(raw.invited_email) : "",
    role: raw.role === "admin" ? "admin" : "member",
    status: normalizeStatus(raw.status),
    expiresAt: String(raw.expires_at),
  };
}

export async function listOrganizationInvitations(
  supabase: SupabaseClient,
  organizationId: string,
  options?: { status?: OrganizationInvitation["status"] },
): Promise<OrganizationInvitation[]> {
  let query = supabase
    .from("organization_invitations")
    .select("id, organization_id, invited_email, role, status, invited_by_profile_id, accepted_at, accepted_by_profile_id, accepted_contact_id, revoked_at, expires_at, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (options?.status) query = query.eq("status", options.status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, unknown>>).map(normalizeInvitation);
}

export async function listOrganizationMemberViews(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<OrganizationMemberView[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("id, profile_id, role, joined_at, profile:profiles!organization_members_profile_id_fkey(first_name, last_name, email)")
    .eq("organization_id", organizationId)
    .order("joined_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).flatMap((row) => {
    if (typeof row.id !== "string" || typeof row.profile_id !== "string") return [];
    const rawProfile = Array.isArray(row.profile) ? row.profile[0] ?? null : row.profile;
    const profile = rawProfile as { first_name?: unknown; last_name?: unknown; email?: unknown } | null;
    const first = typeof profile?.first_name === "string" ? profile.first_name.trim() : "";
    const last = typeof profile?.last_name === "string" ? profile.last_name.trim() : "";
    const email = typeof profile?.email === "string" ? profile.email : null;
    return [{
      id: row.id,
      profileId: row.profile_id,
      role: row.role === "admin" ? "admin" : "member",
      joinedAt: typeof row.joined_at === "string" ? row.joined_at : new Date().toISOString(),
      label: `${first} ${last}`.trim() || email || "Membro",
      email,
    }];
  });
}

function dedupeInviteDrafts(invites: OrganizationInviteDraft[]): OrganizationInviteDraft[] {
  const seen = new Set<string>();
  return invites.flatMap((invite) => {
    const email = normalizeEmail(invite.email);
    if (!email || seen.has(email)) return [];
    seen.add(email);
    return [{ email, role: invite.role === "admin" ? "admin" : "member" }];
  });
}

export async function inviteOrganizationMembers(
  supabase: SupabaseClient,
  organizationId: string,
  invites: OrganizationInviteDraft[],
  actorProfileId: string,
): Promise<{ invitations: OrganizationInvitation[]; summary: OrganizationInviteSummary }> {
  const normalized = dedupeInviteDrafts(invites);
  const emptySummary = {
    pendingInvitations: 0,
    directAssignments: 0,
    updatedExistingMembers: 0,
    unchangedExistingMembers: 0,
    failedEmailDeliveries: 0,
  };
  if (normalized.length === 0) return { invitations: [], summary: emptySummary };

  const emails = normalized.map((invite) => invite.email);
  const [{ data: existingMembers, error: memberError }, { data: profiles, error: profileError }] = await Promise.all([
    supabase.from("organization_members").select("profile_id, role, profile:profiles!organization_members_profile_id_fkey(email)").eq("organization_id", organizationId),
    supabase.from("profiles").select("id, email").in("email", emails),
  ]);
  if (memberError) throw new Error(memberError.message);
  if (profileError) throw new Error(profileError.message);
  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", organizationId)
    .maybeSingle<{ name: string | null }>();
  if (organizationError) throw new Error(organizationError.message);
  const organizationName = organization?.name?.trim() || "Organização";

  const memberByEmail = new Map<string, { profileId: string; role: OrganizationMemberRole }>();
  for (const row of existingMembers ?? []) {
    const rawProfile = Array.isArray(row.profile) ? row.profile[0] ?? null : row.profile;
    const email = rawProfile && typeof rawProfile.email === "string" ? normalizeEmail(rawProfile.email) : "";
    if (email && typeof row.profile_id === "string") {
      memberByEmail.set(email, { profileId: row.profile_id, role: row.role === "admin" ? "admin" : "member" });
    }
  }
  const profileByEmail = new Map<string, string>();
  for (const profile of profiles ?? []) {
    if (typeof profile.id === "string" && typeof profile.email === "string") {
      profileByEmail.set(normalizeEmail(profile.email), profile.id);
    }
  }

  const pendingRows: Array<Record<string, unknown>> = [];
  let directAssignments = 0;
  let updatedExistingMembers = 0;
  let unchangedExistingMembers = 0;
  for (const invite of normalized) {
    const member = memberByEmail.get(invite.email);
    if (member) {
      if (member.role === invite.role) unchangedExistingMembers += 1;
      else {
        const { error } = await supabase.from("organization_members").update({ role: invite.role })
          .eq("organization_id", organizationId).eq("profile_id", member.profileId);
        if (error) throw new Error(error.message);
        updatedExistingMembers += 1;
      }
      continue;
    }
    const profileId = profileByEmail.get(invite.email);
    if (profileId) {
      const { error } = await supabase.from("organization_members").upsert({
        organization_id: organizationId,
        profile_id: profileId,
        role: invite.role,
      }, { onConflict: "organization_id,profile_id" });
      if (error) throw new Error(error.message);
      directAssignments += 1;
      continue;
    }
    pendingRows.push({
      organization_id: organizationId,
      invited_email: invite.email,
      role: invite.role,
      status: "pending",
      invited_by_profile_id: actorProfileId,
      expires_at: new Date(Date.now() + INVITE_EXPIRY_DAYS * 86_400_000).toISOString(),
      accepted_at: null,
      accepted_by_profile_id: null,
      accepted_contact_id: null,
      revoked_at: null,
    });
  }

  if (directAssignments > 0 || updatedExistingMembers > 0) {
    await syncOrganizationPrimaryContactFromAdmins(supabase, organizationId);
  }
  if (pendingRows.length > 0) {
    const { error } = await supabase.from("organization_invitations").upsert(pendingRows, {
      onConflict: "organization_id,invited_email",
      ignoreDuplicates: false,
    });
    if (error) throw new Error(error.message);
    const { data: inserted, error: selectError } = await supabase
      .from("organization_invitations")
      .select("id, invited_email, role")
      .eq("organization_id", organizationId)
      .in("invited_email", pendingRows.map((row) => String(row.invited_email)))
      .eq("status", "pending");
    if (selectError) throw new Error(selectError.message);
    const deliveries = await Promise.all((inserted ?? []).map(async (invitation) => ({
      id: String(invitation.id),
      delivered: await sendOrganizationInviteEmail({
        invitationId: String(invitation.id),
        organizationName,
        invitedEmail: String(invitation.invited_email),
        role: invitation.role === "admin" ? "admin" : "member",
      }),
    })));
    const failedIds = deliveries.filter((result) => !result.delivered).map((result) => result.id);
    if (failedIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("organization_invitations")
        .delete()
        .in("id", failedIds)
        .eq("status", "pending");
      if (deleteError) throw new Error(deleteError.message);
      throw new Error(ORGANIZATION_INVITE_EMAIL_DELIVERY_ERROR);
    }
  }

  return {
    invitations: await listOrganizationInvitations(supabase, organizationId, { status: "pending" }),
    summary: {
      pendingInvitations: pendingRows.length,
      directAssignments,
      updatedExistingMembers,
      unchangedExistingMembers,
      failedEmailDeliveries: 0,
    },
  };
}

export async function revokeOrganizationInvitation(
  supabase: SupabaseClient,
  organizationId: string,
  invitationId: string,
): Promise<void> {
  const { error } = await supabase.from("organization_invitations")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", invitationId).eq("organization_id", organizationId).eq("status", "pending");
  if (error) throw new Error(error.message);
}

export async function acceptOrganizationInvitation(
  supabase: SupabaseClient,
  params: {
    invitationId: string;
    profileId: string;
    userEmail: string;
    ensureCrmContactForProfile: EnsureCrmContact;
  },
): Promise<{ organizationId: string }> {
  const email = normalizeEmail(params.userEmail);
  const { data: invitation, error } = await supabase
    .from("organization_invitations")
    .select("id, organization_id, invited_email, role, status, expires_at")
    .eq("id", params.invitationId)
    .maybeSingle<{ id: string; organization_id: string; invited_email: string; role: string; status: string; expires_at: string }>();
  if (error) throw new Error(error.message);
  if (!invitation?.id) throw new Error("Convite não encontrado.");
  if (normalizeEmail(invitation.invited_email) !== email) throw new Error("Este convite pertence a outro email.");
  if (invitation.status !== "pending") throw new Error("Este convite já não está disponível.");
  if (isInvitationExpired(invitation.expires_at)) {
    const { error: expireError } = await supabase.from("organization_invitations")
      .update({ status: "expired" }).eq("id", invitation.id);
    if (expireError) throw new Error(expireError.message);
    throw new Error("Este convite expirou.");
  }

  const acceptedContact = await params.ensureCrmContactForProfile(params.profileId, {
    source: "organization_invitation_accept",
    serviceClient: supabase,
  });
  if (!acceptedContact.success) {
    throw new Error(acceptedContact.error ?? "Não foi possível associar o contacto CRM ao convite.");
  }
  const role: OrganizationMemberRole = invitation.role === "admin" ? "admin" : "member";
  const { error: memberError } = await supabase.from("organization_members").upsert({
    organization_id: invitation.organization_id,
    profile_id: params.profileId,
    role,
  }, { onConflict: "organization_id,profile_id" });
  if (memberError) throw new Error(memberError.message);
  if (role === "admin") await syncOrganizationPrimaryContactFromAdmins(supabase, invitation.organization_id);
  const { error: updateError } = await supabase.from("organization_invitations").update({
    status: "accepted",
    accepted_at: new Date().toISOString(),
    accepted_by_profile_id: params.profileId,
    accepted_contact_id: acceptedContact.contactId ?? null,
  }).eq("id", invitation.id);
  if (updateError) throw new Error(updateError.message);
  await logOrganizationActivity(supabase, {
    actorProfileId: params.profileId,
    organizationId: invitation.organization_id,
    eventType: "crm_organization_invitation_accepted",
    summary: "Convite de organização aceite.",
    payload: {
      invitation_id: invitation.id,
      organization_id: invitation.organization_id,
      email,
    },
  });
  return { organizationId: invitation.organization_id };
}

export async function registerUserFromOrganizationInvitation(
  supabase: SupabaseClient,
  params: {
    invitationId: string;
    firstName: string;
    lastName: string;
    password: string;
    ensureCrmContactForProfile: EnsureCrmContact;
  },
): Promise<{ email: string; organizationId: string }> {
  const invitation = await getOrganizationInvitationDetails(supabase, params.invitationId);
  if (!invitation) throw new Error("INVITATION_NOT_FOUND");
  if (invitation.status !== "pending") throw new Error("INVITATION_NOT_AVAILABLE");
  if (isInvitationExpired(invitation.expiresAt)) {
    const { error } = await supabase.from("organization_invitations")
      .update({ status: "expired" }).eq("id", invitation.id).eq("status", "pending");
    if (error) throw new Error(error.message);
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
    await acceptOrganizationInvitation(supabase, {
      invitationId: invitation.id,
      profileId: profile.id,
      userEmail: invitation.invitedEmail,
      ensureCrmContactForProfile: params.ensureCrmContactForProfile,
    });
  } catch (caught) {
    if (createdUserId) await supabase.auth.admin.deleteUser(createdUserId);
    throw caught;
  }
  return { email: invitation.invitedEmail, organizationId: invitation.organizationId };
}
