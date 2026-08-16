import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateOrganizationInput, OrganizationMemberRole } from "./data";
import type {
  OrganizationInviteDraft,
  inviteOrganizationMembers,
  logOrganizationActivity,
  listOrganizationInvitations,
  listOrganizationMemberViews,
  resendOrganizationInvitation,
  revokeOrganizationInvitation,
} from "./invitations";

export function json(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers ?? {}) },
  });
}

type OrganizationAccess =
  | { ok: true; serviceSupabase: SupabaseClient; profileId: string; role?: string | null }
  | { ok: false; status: number; error: string };

type OrganizationWriteDependencies = {
  getCreateAccess(): Promise<OrganizationAccess>;
  getManageAccess(organizationId: string): Promise<OrganizationAccess>;
  createOrganization: (supabase: SupabaseClient, input: CreateOrganizationInput) => Promise<unknown>;
  updateOrganization: (supabase: SupabaseClient, id: string, input: CreateOrganizationInput) => Promise<unknown>;
  deleteOrganization: (supabase: SupabaseClient, id: string) => Promise<{ id: string; name: string }>;
  inviteMembers: typeof inviteOrganizationMembers;
  logActivity: typeof logOrganizationActivity;
};

type OrganizationInvitationDependencies = {
  getManageAccess(organizationId: string): Promise<OrganizationAccess>;
  inviteMembers: typeof inviteOrganizationMembers;
  listInvitations: typeof listOrganizationInvitations;
  listMembers: typeof listOrganizationMemberViews;
  revokeInvitation: typeof revokeOrganizationInvitation;
  resendInvitation: typeof resendOrganizationInvitation;
  logActivity: typeof logOrganizationActivity;
};

async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value = await request.json();
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function readOptionalString(body: Record<string, unknown>, key: string): string | null | undefined {
  if (!Object.hasOwn(body, key)) return undefined;
  const value = body[key];
  if (typeof value !== "string") return null;
  return value.trim() || null;
}

function parseInvites(raw: unknown): OrganizationInviteDraft[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const email = typeof record.email === "string" ? record.email.trim().toLowerCase() : "";
    const role: OrganizationMemberRole = record.role === "admin" ? "admin" : "member";
    return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? [{ email, role }] : [];
  });
}

function parseOrganizationInput(body: Record<string, unknown>): CreateOrganizationInput {
  return {
    name: typeof body.name === "string" ? body.name.trim() : "",
    primaryContactId: readOptionalString(body, "primaryContactId"),
    industry: readOptionalString(body, "industry"),
    companySize: readOptionalString(body, "companySize"),
    budgetRange: readOptionalString(body, "budgetRange"),
    websiteUrl: readOptionalString(body, "websiteUrl"),
    addressLine1: readOptionalString(body, "addressLine1"),
    addressLine2: readOptionalString(body, "addressLine2"),
    zipCode: readOptionalString(body, "zipCode"),
    country: readOptionalString(body, "country"),
    taxIdentifierValue:
      readOptionalString(body, "taxIdentifierValue") ?? readOptionalString(body, "nif"),
  };
}

function organizationError(error: unknown): Response {
  const message = error instanceof Error ? error.message : "";
  if (message === "Convite pendente não encontrado.") {
    return json({ error: message }, { status: 404 });
  }
  if (message.startsWith("Não foi possível enviar o email de convite.") || message.startsWith("Não foi possível reenviar o email de convite.")) {
    return json({ error: message }, { status: 502 });
  }
  if (message === "Este convite expirou.") return json({ error: message }, { status: 410 });
  return json({ error: message || "Erro interno do servidor." }, { status: 500 });
}

export function createOrganizationsPostHandler(dependencies: OrganizationWriteDependencies) {
  return async function handleOrganizationsPostRequest(request: Request): Promise<Response> {
    const access = await dependencies.getCreateAccess();
    if (!access.ok) return json({ error: access.error }, { status: access.status });
    const body = await readJsonObject(request);
    if (!body) return json({ error: "Payload inválido." }, { status: 400 });
    const input = parseOrganizationInput(body);
    if (!input.name) return json({ error: "name é obrigatório." }, { status: 400 });
    try {
      const organization = await dependencies.createOrganization(access.serviceSupabase, input) as { id: string };
      const result = await dependencies.inviteMembers(
        access.serviceSupabase,
        organization.id,
        parseInvites(body.invitations),
        access.profileId,
      );
      await dependencies.logActivity(access.serviceSupabase, {
        actorProfileId: access.profileId,
        organizationId: organization.id,
        eventType: "crm_organization_created",
        summary: "Organização CRM criada.",
        payload: {
          organization_id: organization.id,
          pending_invitations: result.summary.pendingInvitations,
          duplicate_pending_invitations: result.summary.duplicatePendingInvitations,
          direct_assignments: result.summary.directAssignments,
          failed_email_deliveries: result.summary.failedEmailDeliveries,
          failed_api_operations: result.summary.failedApiOperations,
        },
      });
      return json({ data: { organization, invitations: result.invitations, outcomes: result.outcomes, inviteSummary: result.summary } }, { status: 201 });
    } catch (error) {
      return organizationError(error);
    }
  };
}

export function createOrganizationPatchHandler(dependencies: OrganizationWriteDependencies) {
  return async function handleOrganizationPatchRequest(
    request: Request,
    context: { params: Promise<{ id: string }> },
  ): Promise<Response> {
    const { id } = await context.params;
    if (!id) return json({ error: "id é obrigatório." }, { status: 400 });
    const access = await dependencies.getManageAccess(id);
    if (!access.ok) return json({ error: access.error }, { status: access.status });
    const body = await readJsonObject(request);
    if (!body) return json({ error: "Payload inválido." }, { status: 400 });
    const input = parseOrganizationInput(body);
    if (!input.name) return json({ error: "name é obrigatório." }, { status: 400 });
    try {
      const organization = await dependencies.updateOrganization(access.serviceSupabase, id, input) as { id: string };
      const result = await dependencies.inviteMembers(
        access.serviceSupabase,
        id,
        parseInvites(body.invitations),
        access.profileId,
      );
      await dependencies.logActivity(access.serviceSupabase, {
        actorProfileId: access.profileId,
        organizationId: id,
        eventType: "crm_organization_updated",
        summary: "Organização CRM atualizada.",
        payload: {
          organization_id: id,
          pending_invitations: result.summary.pendingInvitations,
          direct_assignments: result.summary.directAssignments,
          updated_existing_members: result.summary.updatedExistingMembers,
          duplicate_pending_invitations: result.summary.duplicatePendingInvitations,
          failed_email_deliveries: result.summary.failedEmailDeliveries,
          failed_api_operations: result.summary.failedApiOperations,
        },
      });
      return json({ data: { organization, invitations: result.invitations, outcomes: result.outcomes, inviteSummary: result.summary } });
    } catch (error) {
      return organizationError(error);
    }
  };
}

export function createOrganizationDeleteHandler(dependencies: OrganizationWriteDependencies) {
  return async function handleOrganizationDeleteRequest(
    _request: Request,
    context: { params: Promise<{ id: string }> },
  ): Promise<Response> {
    const { id } = await context.params;
    if (!id) return json({ error: "id é obrigatório." }, { status: 400 });
    const access = await dependencies.getManageAccess(id);
    if (!access.ok) return json({ error: access.error }, { status: access.status });
    try {
      const organization = await dependencies.deleteOrganization(access.serviceSupabase, id);
      await dependencies.logActivity(access.serviceSupabase, {
        actorProfileId: access.profileId,
        organizationId: id,
        eventType: "crm_organization_deleted",
        summary: `Organização CRM eliminada: ${organization.name}`,
        payload: { organization_id: id, organization_name: organization.name },
      });
      return json({ data: { deletedId: id } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("projetos associados")) return json({ error: message }, { status: 409 });
      if (message === "Organização não encontrada.") return json({ error: message }, { status: 404 });
      return organizationError(error);
    }
  };
}

export function createOrganizationInvitationsHandler(dependencies: OrganizationInvitationDependencies) {
  return {
    GET: async (request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> => {
      const { id } = await context.params;
      if (!id) return json({ error: "id é obrigatório." }, { status: 400 });
      const access = await dependencies.getManageAccess(id);
      if (!access.ok) return json({ error: access.error }, { status: access.status });
      try {
        const includeHistory = new URL(request.url).searchParams.get("status") === "all";
        const [members, invitations] = await Promise.all([
          dependencies.listMembers(access.serviceSupabase, id),
          dependencies.listInvitations(access.serviceSupabase, id, includeHistory ? undefined : { status: "pending" }),
        ]);
        return json({ data: { members, invitations } });
      } catch (error) {
        return organizationError(error);
      }
    },
    POST: async (request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> => {
      const { id } = await context.params;
      if (!id) return json({ error: "id é obrigatório." }, { status: 400 });
      const access = await dependencies.getManageAccess(id);
      if (!access.ok) return json({ error: access.error }, { status: access.status });
      const body = await readJsonObject(request);
      if (!body) return json({ error: "Payload inválido." }, { status: 400 });
      const invitations = parseInvites(body.invitations);
      if (invitations.length === 0) {
        return json({ error: "Nenhum convite válido foi enviado." }, { status: 400 });
      }
      try {
        const result = await dependencies.inviteMembers(
          access.serviceSupabase,
          id,
          invitations,
          access.profileId,
        );
        await dependencies.logActivity(access.serviceSupabase, {
          actorProfileId: access.profileId,
          organizationId: id,
          eventType: "crm_organization_invitations_created",
          summary: "Convites da organização CRM criados.",
          payload: {
            organization_id: id,
            invitations: result.invitations.length,
            pending_invitations: result.summary.pendingInvitations,
            direct_assignments: result.summary.directAssignments,
            updated_existing_members: result.summary.updatedExistingMembers,
            duplicate_pending_invitations: result.summary.duplicatePendingInvitations,
            failed_email_deliveries: result.summary.failedEmailDeliveries,
            failed_api_operations: result.summary.failedApiOperations,
          },
        });
        return json({ data: { invitations: result.invitations, outcomes: result.outcomes, inviteSummary: result.summary } }, { status: 201 });
      } catch (error) {
        return organizationError(error);
      }
    },
  };
}

type OrganizationMemberMutationDependencies = {
  getManageAccess: OrganizationInvitationDependencies["getManageAccess"];
  updateMemberRole: (
    supabase: SupabaseClient,
    organizationId: string,
    profileId: string,
    role: "admin" | "member",
  ) => Promise<unknown>;
  removeMember: (supabase: SupabaseClient, organizationId: string, profileId: string) => Promise<void>;
  logActivity: OrganizationInvitationDependencies["logActivity"];
};

export function createOrganizationMemberMutationHandlers(dependencies: OrganizationMemberMutationDependencies) {
  return {
    PATCH: async (request: Request, context: { params: Promise<{ id: string; profileId: string }> }): Promise<Response> => {
      const { id, profileId } = await context.params;
      if (!id || !profileId) return json({ error: "id e profileId são obrigatórios." }, { status: 400 });
      const access = await dependencies.getManageAccess(id);
      if (!access.ok) return json({ error: access.error }, { status: access.status });
      const body = await readJsonObject(request);
      const role = body?.role === "admin" ? "admin" : body?.role === "member" ? "member" : null;
      if (!role) return json({ error: "Função inválida." }, { status: 400 });
      try {
        const member = await dependencies.updateMemberRole(access.serviceSupabase, id, profileId, role);
        await dependencies.logActivity(access.serviceSupabase, {
          actorProfileId: access.profileId,
          organizationId: id,
          eventType: "crm_organization_member_role_updated",
          summary: "Função de membro da organização atualizada.",
          payload: { organization_id: id, profile_id: profileId, role },
        });
        return json({ data: { member } });
      } catch (error) {
        return organizationError(error);
      }
    },
    DELETE: async (_request: Request, context: { params: Promise<{ id: string; profileId: string }> }): Promise<Response> => {
      const { id, profileId } = await context.params;
      if (!id || !profileId) return json({ error: "id e profileId são obrigatórios." }, { status: 400 });
      const access = await dependencies.getManageAccess(id);
      if (!access.ok) return json({ error: access.error }, { status: access.status });
      try {
        await dependencies.removeMember(access.serviceSupabase, id, profileId);
        await dependencies.logActivity(access.serviceSupabase, {
          actorProfileId: access.profileId,
          organizationId: id,
          eventType: "crm_organization_member_removed",
          summary: "Acesso à organização removido.",
          payload: { organization_id: id, profile_id: profileId },
        });
        return json({ data: { success: true } });
      } catch (error) {
        return organizationError(error);
      }
    },
  };
}

export function createOrganizationInvitationDeleteHandler(dependencies: OrganizationInvitationDependencies) {
  return async function handleOrganizationInvitationDeleteRequest(
    _request: Request,
    context: { params: Promise<{ id: string; invitationId: string }> },
  ): Promise<Response> {
    const { id, invitationId } = await context.params;
    if (!id || !invitationId) return json({ error: "id e invitationId são obrigatórios." }, { status: 400 });
    const access = await dependencies.getManageAccess(id);
    if (!access.ok) return json({ error: access.error }, { status: access.status });
    try {
      await dependencies.revokeInvitation(access.serviceSupabase, id, invitationId);
      await dependencies.logActivity(access.serviceSupabase, {
        actorProfileId: access.profileId,
        organizationId: id,
        eventType: "crm_organization_invitation_revoked",
        summary: "Convite da organização CRM revogado.",
        payload: { organization_id: id, invitation_id: invitationId },
      });
      return json({ data: { success: true } });
    } catch (error) {
      return organizationError(error);
    }
  };
}

export function createOrganizationInvitationResendHandler(dependencies: OrganizationInvitationDependencies) {
  return async function handleOrganizationInvitationResendRequest(
    _request: Request,
    context: { params: Promise<{ id: string; invitationId: string }> },
  ): Promise<Response> {
    const { id, invitationId } = await context.params;
    if (!id || !invitationId) return json({ error: "id e invitationId são obrigatórios." }, { status: 400 });
    const access = await dependencies.getManageAccess(id);
    if (!access.ok) return json({ error: access.error }, { status: access.status });
    try {
      const invitation = await dependencies.resendInvitation(access.serviceSupabase, id, invitationId);
      await dependencies.logActivity(access.serviceSupabase, {
        actorProfileId: access.profileId,
        organizationId: id,
        eventType: "crm_organization_invitation_resent",
        summary: "Convite da organização CRM reenviado.",
        payload: { organization_id: id, invitation_id: invitationId },
      });
      return json({ data: { invitation } });
    } catch (error) {
      return organizationError(error);
    }
  };
}
