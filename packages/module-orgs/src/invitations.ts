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
  acceptedByProfileId?: string | null;
};

export type OrganizationInviteSummary = {
  pendingInvitations: number;
  duplicatePendingInvitations: number;
  directAssignments: number;
  updatedExistingMembers: number;
  unchangedExistingMembers: number;
  failedEmailDeliveries: number;
  failedContactLinks: number;
  failedApiOperations: number;
};

export type OrganizationInviteOutcomeStatus =
  | "immediate_access"
  | "membership_updated"
  | "already_member"
  | "pending_invitation"
  | "duplicate_pending"
  | "email_failed"
  | "api_failed";

export type OrganizationInviteOutcome = {
  email: string;
  role: OrganizationMemberRole;
  status: OrganizationInviteOutcomeStatus;
  profileId?: string;
  invitationId?: string;
  message?: string;
  failureKind?: "crm_link" | "membership" | "invitation";
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
  options: { source: string; organizationId?: string | null; serviceClient: SupabaseClient },
) => Promise<{ success: boolean; contactId?: string; error?: string }>;

export type SendOrganizationInvite = typeof sendOrganizationInviteEmail;

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
  const expiresAt = String(raw.expires_at);
  const storedStatus = normalizeStatus(raw.status);
  return {
    id: String(raw.id),
    organizationId: String(raw.organization_id),
    email: typeof raw.invited_email === "string" ? normalizeEmail(raw.invited_email) : "",
    role: raw.role === "admin" ? "admin" : "member",
    status: storedStatus === "pending" && isInvitationExpired(expiresAt) ? "expired" : storedStatus,
    createdAt: String(raw.created_at),
    expiresAt,
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
    .select("id, organization_id, invited_email, role, status, expires_at, accepted_by_profile_id, organizations(name)")
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
    acceptedByProfileId: typeof raw.accepted_by_profile_id === "string" ? raw.accepted_by_profile_id : null,
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
  options?: {
    ensureCrmContactForProfile?: EnsureCrmContact;
    sendInviteEmail?: SendOrganizationInvite;
    contactIntegration?: "database";
  },
): Promise<{ invitations: OrganizationInvitation[]; outcomes: OrganizationInviteOutcome[]; summary: OrganizationInviteSummary }> {
  assertInvitationContactIntegration(options ?? {});
  const normalized = dedupeInviteDrafts(invites);
  const emptySummary = {
    pendingInvitations: 0,
    duplicatePendingInvitations: 0,
    directAssignments: 0,
    updatedExistingMembers: 0,
    unchangedExistingMembers: 0,
    failedEmailDeliveries: 0,
    failedContactLinks: 0,
    failedApiOperations: 0,
  };
  if (normalized.length === 0) return { invitations: [], outcomes: [], summary: emptySummary };

  const emails = normalized.map((invite) => invite.email);
  const [{ data: profiles, error: profileError }, { data: existingInvitations, error: invitationError }] = await Promise.all([
    supabase.from("profiles").select("id, email").in("email", emails),
    supabase.from("organization_invitations").select("id, invited_email, role, status, expires_at").eq("organization_id", organizationId).in("invited_email", emails),
  ]);
  if (profileError) throw new Error(profileError.message);
  if (invitationError) throw new Error(invitationError.message);
  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", organizationId)
    .maybeSingle<{ name: string | null }>();
  if (organizationError) throw new Error(organizationError.message);
  const organizationName = organization?.name?.trim() || "Organização";

  const profileByEmail = new Map<string, string>();
  for (const profile of profiles ?? []) {
    if (typeof profile.id === "string" && typeof profile.email === "string") {
      profileByEmail.set(normalizeEmail(profile.email), profile.id);
    }
  }
  const pendingInvitationByEmail = new Map<string, { id: string; role: OrganizationMemberRole }>();
  for (const invitation of existingInvitations ?? []) {
    if (
      invitation.status !== "pending"
      || typeof invitation.id !== "string"
      || typeof invitation.invited_email !== "string"
      || isInvitationExpired(String(invitation.expires_at))
    ) continue;
    pendingInvitationByEmail.set(normalizeEmail(invitation.invited_email), {
      id: invitation.id,
      role: invitation.role === "admin" ? "admin" : "member",
    });
  }

  const pendingRows: Array<Record<string, unknown>> = [];
  const outcomes: OrganizationInviteOutcome[] = [];
  let directAssignments = 0;
  let updatedExistingMembers = 0;
  let unchangedExistingMembers = 0;
  for (const invite of normalized) {
    const profileId = profileByEmail.get(invite.email);
    if (profileId) {
      // The database resolves current membership under lock and rolls back only
      // this transaction's writes. Never compensate from an earlier snapshot.
      const { data, error } = await supabase.rpc("assign_organization_member_atomic", {
        p_organization_id: organizationId,
        p_profile_id: profileId,
        p_email: invite.email,
        p_role: invite.role,
        p_actor_profile_id: actorProfileId,
      });
      const status = data?.status;
      if (error || !["immediate_access", "membership_updated", "already_member"].includes(status)) {
        const contactFailure = error?.code === "BW001";
        outcomes.push({
          email: invite.email, role: invite.role, status: "api_failed", profileId,
          message: contactFailure
            ? "Não foi possível ligar o contacto CRM. Nenhuma alteração de acesso foi guardada."
            : "Não foi possível confirmar a alteração de acesso à organização. Tente novamente.",
          failureKind: contactFailure ? "crm_link" : "membership",
        });
        continue;
      }
      if (status === "immediate_access") directAssignments += 1;
      else if (status === "membership_updated") updatedExistingMembers += 1;
      else unchangedExistingMembers += 1;
      outcomes.push({ email: invite.email, role: invite.role, status, profileId });
      continue;
    }
    const pendingInvitation = pendingInvitationByEmail.get(invite.email);
    if (pendingInvitation) {
      outcomes.push({ email: invite.email, role: pendingInvitation.role, status: "duplicate_pending", invitationId: pendingInvitation.id });
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

  if (pendingRows.length > 0) {
    const { error } = await supabase.from("organization_invitations").upsert(pendingRows, {
      onConflict: "organization_id,invited_email",
      ignoreDuplicates: false,
    });
    if (error) {
      outcomes.push(...pendingRows.map((row) => ({
        email: String(row.invited_email), role: row.role === "admin" ? "admin" as const : "member" as const,
        status: "api_failed" as const, message: "Não foi possível criar o convite.", failureKind: "invitation" as const,
      })));
    }
    const { data: inserted, error: selectError } = error ? { data: [], error: null } : await supabase
      .from("organization_invitations")
      .select("id, invited_email, role, expires_at")
      .eq("organization_id", organizationId)
      .in("invited_email", pendingRows.map((row) => String(row.invited_email)))
      .eq("status", "pending");
    if (selectError) {
      outcomes.push(...pendingRows.map((row) => ({
        email: String(row.invited_email), role: row.role === "admin" ? "admin" as const : "member" as const,
        status: "api_failed" as const, message: "Não foi possível confirmar o convite criado.", failureKind: "invitation" as const,
      })));
    }
    const deliveries = await Promise.all((inserted ?? []).map(async (invitation) => ({
      id: String(invitation.id),
      email: normalizeEmail(String(invitation.invited_email)),
      role: invitation.role === "admin" ? "admin" as const : "member" as const,
      delivered: await (options?.sendInviteEmail ?? sendOrganizationInviteEmail)({
        invitationId: String(invitation.id),
        organizationName,
        invitedEmail: String(invitation.invited_email),
        role: invitation.role === "admin" ? "admin" : "member",
        expiresAt: typeof invitation.expires_at === "string" ? invitation.expires_at : undefined,
      }),
    })));
    const failedIds = deliveries.filter((result) => !result.delivered).map((result) => result.id);
    let cleanupFailed = false;
    if (failedIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("organization_invitations")
        .delete()
        .in("id", failedIds)
        .eq("status", "pending");
      cleanupFailed = Boolean(deleteError);
    }
    for (const delivery of deliveries) {
      outcomes.push({
        email: delivery.email,
        role: delivery.role,
        status: delivery.delivered ? "pending_invitation" : "email_failed",
        invitationId: delivery.delivered || cleanupFailed ? delivery.id : undefined,
        message: delivery.delivered ? undefined : cleanupFailed
          ? "Não foi possível enviar o email. O convite pendente foi mantido; reenvie-o ou revogue-o."
          : ORGANIZATION_INVITE_EMAIL_DELIVERY_ERROR,
      });
    }
  }

  const failedEmailDeliveries = outcomes.filter((outcome) => outcome.status === "email_failed").length;
  const failedContactLinks = outcomes.filter((outcome) => outcome.status === "api_failed" && outcome.failureKind === "crm_link").length;
  const failedApiOperations = outcomes.filter((outcome) => outcome.status === "api_failed").length;
  let invitations: OrganizationInvitation[] = [];
  try {
    invitations = await listOrganizationInvitations(supabase, organizationId, { status: "pending" });
  } catch (error) {
    console.error("[organizations.invite-members.refresh]", error);
  }

  return {
    invitations,
    outcomes,
    summary: {
      pendingInvitations: outcomes.filter((outcome) => outcome.status === "pending_invitation").length,
      duplicatePendingInvitations: outcomes.filter((outcome) => outcome.status === "duplicate_pending").length,
      directAssignments,
      updatedExistingMembers,
      unchangedExistingMembers,
      failedEmailDeliveries,
      failedContactLinks,
      failedApiOperations,
    },
  };
}

export async function resendOrganizationInvitation(
  supabase: SupabaseClient,
  organizationId: string,
  invitationId: string,
  options?: { sendInviteEmail?: SendOrganizationInvite },
): Promise<OrganizationInvitation> {
  const { data, error } = await supabase
    .from("organization_invitations")
    .select("id, organization_id, invited_email, role, status, invited_by_profile_id, accepted_at, accepted_by_profile_id, accepted_contact_id, revoked_at, expires_at, created_at, organizations(name)")
    .eq("id", invitationId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.status !== "pending") throw new Error("Convite pendente não encontrado.");
  if (isInvitationExpired(String(data.expires_at))) {
    const { error: expireError } = await supabase
      .from("organization_invitations")
      .update({ status: "expired" })
      .eq("id", invitationId)
      .eq("status", "pending");
    if (expireError) throw new Error(expireError.message);
    throw new Error("Este convite expirou.");
  }
  const organizationRaw = Array.isArray(data.organizations) ? data.organizations[0] ?? null : data.organizations;
  const organizationName = organizationRaw && typeof organizationRaw === "object" && typeof organizationRaw.name === "string"
    ? organizationRaw.name
    : "Organização";
  const delivered = await (options?.sendInviteEmail ?? sendOrganizationInviteEmail)({
    invitationId,
    organizationName,
    invitedEmail: String(data.invited_email),
    role: data.role === "admin" ? "admin" : "member",
    expiresAt: String(data.expires_at),
  });
  if (!delivered) {
    throw new Error("Não foi possível reenviar o email de convite. O convite pendente foi mantido.");
  }
  return normalizeInvitation(data as Record<string, unknown>);
}

export async function revokeOrganizationInvitation(
  supabase: SupabaseClient,
  organizationId: string,
  invitationId: string,
): Promise<void> {
  const { data, error } = await supabase.from("organization_invitations")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", invitationId).eq("organization_id", organizationId).eq("status", "pending")
    .select("id");
  if (error) throw new Error(error.message);
  if (!(data ?? []).some((row) => row.id === invitationId)) throw new Error("Convite pendente não encontrado.");
}

export async function acceptOrganizationInvitation(
  supabase: SupabaseClient,
  params: {
    invitationId: string;
    profileId: string;
    userEmail: string;
    ensureCrmContactForProfile?: EnsureCrmContact;
    contactIntegration?: "database";
  },
): Promise<{ organizationId: string }> {
  assertInvitationContactIntegration(params);
  const { data, error } = await supabase.rpc("accept_organization_invitation", {
    p_invitation_id: params.invitationId,
    p_profile_id: params.profileId,
    p_user_email: normalizeEmail(params.userEmail),
  });
  if (error) throw new Error(error.message);
  if (data?.status === "expired") throw new Error("Este convite expirou.");
  if (data?.status !== "accepted" || typeof data.organizationId !== "string") {
    throw new Error("Não foi possível confirmar a aceitação do convite.");
  }
  return { organizationId: data.organizationId };
}

export async function registerUserFromOrganizationInvitation(
  supabase: SupabaseClient,
  params: {
    invitationId: string;
    firstName: string;
    lastName: string;
    password: string;
    ensureCrmContactForProfile?: EnsureCrmContact;
    contactIntegration?: "database";
  },
): Promise<{ email: string; organizationId: string }> {
  assertInvitationContactIntegration(params);
  const invitation = await getOrganizationInvitationDetails(supabase, params.invitationId);
  if (!invitation) throw new Error("INVITATION_NOT_FOUND");
  if (invitation.status !== "pending" && invitation.status !== "accepted") throw new Error("INVITATION_NOT_AVAILABLE");
  if (invitation.status === "accepted") {
    if (!invitation.acceptedByProfileId) throw new Error("INVITATION_NOT_AVAILABLE");
    const accepted = await acceptOrganizationInvitation(supabase, {
      invitationId: invitation.id,
      profileId: invitation.acceptedByProfileId,
      userEmail: invitation.invitedEmail,
      ensureCrmContactForProfile: params.ensureCrmContactForProfile,
      contactIntegration: params.contactIntegration,
    });
    return { email: invitation.invitedEmail, ...accepted };
  }
  if (invitation.status === "pending" && isInvitationExpired(invitation.expiresAt)) {
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
  if (error) {
    if (!isExistingAccountError(error)) throw new Error(error.message);
    userId = await findAuthUserIdByEmail(supabase, invitation.invitedEmail);
    if (!userId) throw new Error("ACCOUNT_ALREADY_EXISTS");
  }
  if (!userId) throw new Error("Não foi possível criar utilizador.");

  // A failed/unknown RPC response must not delete an identity whose acceptance
  // may have committed. The next registration attempt resolves the same account.
  const profile = await ensureInvitationProfile(supabase, {
    userId,
    email: invitation.invitedEmail,
    firstName,
    lastName,
  });
  const accepted = await acceptOrganizationInvitation(supabase, {
    invitationId: invitation.id,
    profileId: profile.id,
    userEmail: invitation.invitedEmail,
    ensureCrmContactForProfile: params.ensureCrmContactForProfile,
    contactIntegration: params.contactIntegration,
  });
  return { email: invitation.invitedEmail, ...accepted };
}

/** Marks a stock callback whose invitation behavior is implemented by the shipped SQL hook. */
export const DATABASE_INVITATION_CONTACT_INTEGRATION = Symbol.for("brightweb.orgs.database-invitation-contact-integration.v1");

function assertInvitationContactIntegration(params: {
  ensureCrmContactForProfile?: EnsureCrmContact;
  contactIntegration?: "database";
}): void {
  if (params.ensureCrmContactForProfile && params.contactIntegration !== "database" &&
      Reflect.get(params.ensureCrmContactForProfile, DATABASE_INVITATION_CONTACT_INTEGRATION) !== true) {
    throw new Error("INVITATION_CONTACT_INTEGRATION_MIGRATION_REQUIRED");
  }
}
