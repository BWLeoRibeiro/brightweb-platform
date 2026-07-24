import {
  ADMIN_USERS_DEFAULT_PAGE_SIZE,
  ADMIN_USERS_MAX_PAGE_SIZE,
  type AdminManagedRole,
} from "./users-data";
import type { applyAdminRoleChanges } from "./roles";
import type { listAdminUsers } from "./users-data";
import type {
  AdminInviteRole,
  createAdminUserInvitation,
  listAdminUserInvitations,
  revokeAdminUserInvitation,
} from "./invitations";

export function json(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}

function parsePositiveInteger(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function normalizeRoleFilter(value: string | null): AdminManagedRole | null {
  if (value === "client" || value === "staff" || value === "admin") {
    return value;
  }

  return null;
}

export function parseAdminUsersListRequest(request: Request | URL | string) {
  const url = request instanceof URL ? request : new URL(typeof request === "string" ? request : request.url);

  return {
    page: parsePositiveInteger(url.searchParams.get("page"), 1),
    pageSize: Math.min(
      parsePositiveInteger(url.searchParams.get("pageSize"), ADMIN_USERS_DEFAULT_PAGE_SIZE),
      ADMIN_USERS_MAX_PAGE_SIZE,
    ),
    search: url.searchParams.get("search")?.trim() ?? "",
    roleFilter: normalizeRoleFilter(url.searchParams.get("role")),
  };
}

export function parseAdminRoleChangePayload(payload: unknown) {
  const profileIds = Array.isArray((payload as { profileIds?: unknown })?.profileIds)
    ? (payload as { profileIds: unknown[] }).profileIds.filter(
        (value): value is string => typeof value === "string" && value.trim().length > 0,
      )
    : [];
  const newRole = normalizeRoleFilter((payload as { newRole?: string | null })?.newRole ?? null);
  const reason = typeof (payload as { reason?: unknown })?.reason === "string"
    ? (payload as { reason: string }).reason.trim()
    : "";

  return {
    profileIds,
    newRole,
    reason,
  };
}

type ServerRoleAccess =
  | {
    ok: true;
    supabase: unknown;
  }
  | {
    ok: false;
    status: number;
    error: string;
  };

type AdminHttpDependencies = {
  getAccess: () => Promise<ServerRoleAccess>;
  listUsers: typeof listAdminUsers;
  applyRoleChanges: typeof applyAdminRoleChanges;
};

export function createAdminUsersGetHandler(dependencies: AdminHttpDependencies) {
  return async function handleAdminUsersGetRequest(request: Request): Promise<Response> {
    const access = await dependencies.getAccess();
    if (!access.ok) {
      return json({ error: access.error }, { status: access.status });
    }

    const { page, pageSize, search, roleFilter } = parseAdminUsersListRequest(request);

    try {
      const result = await dependencies.listUsers({
        supabase: access.supabase as never,
        search,
        roleFilter,
        page,
        pageSize,
      });

      return json(result);
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "Não foi possível carregar utilizadores admin." },
        { status: 500 },
      );
    }
  };
}

export function createAdminUsersRoleChangeHandler(dependencies: AdminHttpDependencies) {
  return async function handleAdminUsersRoleChangeRequest(request: Request): Promise<Response> {
    const access = await dependencies.getAccess();
    if (!access.ok) {
      return json({ error: access.error }, { status: access.status });
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Pedido inválido." }, { status: 400 });
    }

    const { profileIds, newRole, reason } = parseAdminRoleChangePayload(payload);

    if (profileIds.length === 0) {
      return json({ error: "É necessário indicar pelo menos um utilizador." }, { status: 400 });
    }

    if (!newRole) {
      return json({ error: "Função inválida." }, { status: 400 });
    }

    if (!reason) {
      return json({ error: "O motivo é obrigatório." }, { status: 400 });
    }

    try {
      const result = await dependencies.applyRoleChanges({
        supabase: access.supabase as never,
        profileIds,
        newRole,
        reason,
      });

      return json(result);
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "Não foi possível atualizar funções." },
        { status: 500 },
      );
    }
  };
}

type AdminInvitationAccess =
  | { ok: true; profileId: string }
  | { ok: false; status: number; error: string };

type AdminInvitationHttpDependencies = {
  getAccess(): Promise<AdminInvitationAccess>;
  getServiceClient(): unknown;
  listInvitations: typeof listAdminUserInvitations;
  createInvitation: typeof createAdminUserInvitation;
  revokeInvitation: typeof revokeAdminUserInvitation;
};

function adminInvitationError(error: unknown): Response {
  const message = error instanceof Error ? error.message : "";
  const statuses: Record<string, number> = {
    EMAIL_REQUIRED: 400,
    ACCOUNT_ALREADY_EXISTS: 409,
    PENDING_INVITATION_EXISTS: 409,
    "Não foi possível enviar o email de convite. O convite não foi guardado. Verifique a configuração do Resend.": 502,
    "A tabela de convites de utilizadores ainda não existe na base de dados. Aplique a migration admin_user_invitations.": 503,
  };
  const errors: Record<string, string> = {
    EMAIL_REQUIRED: "E-mail obrigatório.",
    ACCOUNT_ALREADY_EXISTS: "Já existe uma conta com este e-mail. Atualize a função na lista de utilizadores.",
    PENDING_INVITATION_EXISTS: "Já existe um convite pendente para este e-mail.",
  };
  return json({ error: errors[message] ?? (message || "Não foi possível gerir o convite.") }, {
    status: statuses[message] ?? 500,
  });
}

export function createAdminUserInvitationsHandler(dependencies: AdminInvitationHttpDependencies) {
  return {
    GET: async (): Promise<Response> => {
      const access = await dependencies.getAccess();
      if (!access.ok) return json({ error: access.error }, { status: access.status });
      try {
        const invitations = await dependencies.listInvitations(dependencies.getServiceClient() as never);
        return json({ data: invitations });
      } catch (error) {
        return adminInvitationError(error);
      }
    },
    POST: async (request: Request): Promise<Response> => {
      const access = await dependencies.getAccess();
      if (!access.ok) return json({ error: access.error }, { status: access.status });
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Payload inválido." }, { status: 400 });
      }
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return json({ error: "Payload inválido." }, { status: 400 });
      }
      const record = body as Record<string, unknown>;
      const email = typeof record.email === "string" ? record.email.trim() : "";
      const role: AdminInviteRole | null =
        record.role === "staff" || record.role === "admin" ? record.role : null;
      if (!email || !role) {
        return json({ error: "E-mail e função são obrigatórios." }, { status: 400 });
      }
      try {
        const invitation = await dependencies.createInvitation(dependencies.getServiceClient() as never, {
          email,
          role,
          invitedByProfileId: access.profileId,
        });
        return json({ data: invitation }, { status: 201 });
      } catch (error) {
        return adminInvitationError(error);
      }
    },
  };
}

export function createAdminUserInvitationDeleteHandler(dependencies: AdminInvitationHttpDependencies) {
  return async function handleAdminUserInvitationDeleteRequest(
    _request: Request,
    context: { params: Promise<{ invitationId: string }> },
  ): Promise<Response> {
    const access = await dependencies.getAccess();
    if (!access.ok) return json({ error: access.error }, { status: access.status });
    const { invitationId } = await context.params;
    try {
      await dependencies.revokeInvitation(dependencies.getServiceClient() as never, invitationId, {
        revokedByProfileId: access.profileId,
      });
      return json({ data: { id: invitationId } });
    } catch (error) {
      return adminInvitationError(error);
    }
  };
}
