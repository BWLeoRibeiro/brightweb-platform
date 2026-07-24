import { publicError, sanitizePublicError, type PublicError } from "@brightweblabs/infra/robustness";
import { validatePassword } from "./shared";

type InvitationKind = "organization" | "admin";
type InvitationDetails = {
  id: string;
  invitedEmail: string;
  status: string;
  expiresAt: string;
  role?: string;
  organizationName?: string;
};
type InvitationAccess =
  | { ok: true; user: { email?: string | null }; profileId: string }
  | { ok: false; status: number; error: string };

export type InvitationHttpDependencies = {
  getServiceClient(): unknown;
  getAccess(): Promise<InvitationAccess>;
  getOrganizationInvitation(client: never, invitationId: string): Promise<InvitationDetails | null>;
  getAdminInvitation(client: never, invitationId: string): Promise<InvitationDetails | null>;
  registerOrganizationInvitation(client: never, input: {
    invitationId: string; firstName: string; lastName: string; password: string;
  }): Promise<{ email: string; organizationId: string }>;
  registerAdminInvitation(client: never, input: {
    invitationId: string; firstName: string; lastName: string; password: string;
  }): Promise<{ email: string; role: string }>;
  acceptOrganizationInvitation(client: never, input: {
    invitationId: string; profileId: string; userEmail: string;
  }): Promise<{ organizationId: string }>;
};

function json(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers ?? {}) },
  });
}

function readKind(value: unknown): InvitationKind | null {
  return value === "organization" || value === "admin" ? value : null;
}

async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? body as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function registerError(error: unknown): Response {
  const knownErrors: Readonly<Record<string, PublicError & { status: number }>> = {
    INVITATION_NOT_FOUND: { code: "INVITATION_NOT_FOUND", message: "Convite não encontrado.", status: 404 },
    INVITATION_NOT_AVAILABLE: {
      code: "INVITATION_NOT_AVAILABLE",
      message: "Este convite já não está disponível.",
      status: 409,
    },
    INVITATION_EXPIRED: { code: "INVITATION_EXPIRED", message: "Este convite expirou.", status: 410 },
    ACCOUNT_ALREADY_EXISTS: {
      code: "ACCOUNT_ALREADY_EXISTS",
      message: "Já existe uma conta para este e-mail. Inicie sessão para continuar.",
      status: 409,
    },
  };
  const message = error instanceof Error ? error.message : "";
  const known = knownErrors[message];
  if (known) return json(publicError(known.code, known.message), { status: known.status });
  return json(
    sanitizePublicError(error, {}, "Erro interno do servidor.", "core-auth.invitation.register"),
    { status: 500 },
  );
}

export function createInvitationDetailsHandler(dependencies: InvitationHttpDependencies) {
  return async function handleInvitationGetRequest(
    request: Request,
    context: { params: Promise<{ invitationId: string }> },
  ): Promise<Response> {
    const { invitationId } = await context.params;
    const kind = readKind(new URL(request.url).searchParams.get("kind"));
    if (!kind) return json(publicError("INVALID_INVITATION_KIND", "Tipo de convite inválido."), { status: 400 });
    try {
      const client = dependencies.getServiceClient() as never;
      const details = kind === "admin"
        ? await dependencies.getAdminInvitation(client, invitationId)
        : await dependencies.getOrganizationInvitation(client, invitationId);
      if (!details) return json(null);
      return json({
        id: details.id,
        email: details.invitedEmail,
        status: details.status,
        expiresAt: details.expiresAt,
        kind,
        organizationName: details.organizationName,
        role: details.role,
      });
    } catch (error) {
      return json(
        sanitizePublicError(error, {}, "Erro interno do servidor.", "core-auth.invitation.details"),
        { status: 500 },
      );
    }
  };
}

export function createInvitationRegisterHandler(dependencies: InvitationHttpDependencies) {
  return async function handleInvitationRegisterRequest(
    request: Request,
    context: { params: Promise<{ invitationId: string }> },
  ): Promise<Response> {
    const { invitationId } = await context.params;
    const body = await readJsonObject(request);
    if (!body) return json(publicError("INVALID_PAYLOAD", "Payload inválido."), { status: 400 });
    const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
    const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
    const password = typeof body.password === "string" ? body.password.trim() : "";
    const kind = readKind(body.kind);
    if (!firstName || !lastName) {
      return json(publicError("NAME_REQUIRED", "Nome e apelido são obrigatórios."), { status: 400 });
    }
    if (!kind) return json(publicError("INVALID_INVITATION_KIND", "Tipo de convite inválido."), { status: 400 });
    const validation = validatePassword(password);
    if (!validation.isValid) {
      return json(publicError("INVALID_PASSWORD", validation.errors.join(". ")), { status: 400 });
    }
    try {
      const client = dependencies.getServiceClient() as never;
      const result = kind === "admin"
        ? await dependencies.registerAdminInvitation(client, { invitationId, firstName, lastName, password })
        : await dependencies.registerOrganizationInvitation(client, { invitationId, firstName, lastName, password });
      return json({ data: result }, { status: 201 });
    } catch (error) {
      return registerError(error);
    }
  };
}

export function createInvitationAcceptHandler(dependencies: InvitationHttpDependencies) {
  return async function handleInvitationAcceptRequest(
    _request: Request,
    context: { params: Promise<{ invitationId: string }> },
  ): Promise<Response> {
    const { invitationId } = await context.params;
    try {
      const access = await dependencies.getAccess();
      if (!access.ok) {
        const code = access.status === 401
          ? "UNAUTHORIZED"
          : access.status === 403
            ? "FORBIDDEN"
            : access.status === 409
              ? "PROFILE_MISSING"
              : "ACCESS_UNAVAILABLE";
        return json(publicError(code, access.error), { status: access.status });
      }
      if (!access.user.email) {
        return json(publicError("ACCOUNT_EMAIL_MISSING", "E-mail da conta em falta."), { status: 409 });
      }
      const result = await dependencies.acceptOrganizationInvitation(dependencies.getServiceClient() as never, {
        invitationId,
        profileId: access.profileId,
        userEmail: access.user.email,
      });
      return json({ data: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro interno do servidor.";
      const knownErrors: Readonly<Record<string, PublicError & { status: number }>> = {
        "Convite não encontrado.": {
          code: "INVITATION_NOT_FOUND",
          message: "Convite não encontrado.",
          status: 404,
        },
        "Este convite expirou.": {
          code: "INVITATION_EXPIRED",
          message: "Este convite expirou.",
          status: 410,
        },
        "Este convite pertence a outro email.": {
          code: "INVITATION_EMAIL_MISMATCH",
          message: "Este convite pertence a outro email.",
          status: 409,
        },
        "Este convite já não está disponível.": {
          code: "INVITATION_NOT_AVAILABLE",
          message: "Este convite já não está disponível.",
          status: 409,
        },
      };
      const known = knownErrors[message];
      if (known) return json(publicError(known.code, known.message), { status: known.status });
      return json(
        sanitizePublicError(error, {}, "Erro interno do servidor.", "core-auth.invitation.accept"),
        { status: 500 },
      );
    }
  };
}
