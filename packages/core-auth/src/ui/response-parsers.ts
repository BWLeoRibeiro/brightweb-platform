import { readPublicError } from "@brightweblabs/infra/robustness";
import type { AuthInvitation } from "./types";

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function readPayload(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function readErrorMessage(payload: unknown): string | null {
  const error = readPublicError(payload, "");
  return error.message || null;
}

function assertSuccessfulResponse(response: Response, payload: unknown): void {
  if (response.ok) return;
  throw new Error(readErrorMessage(payload) ?? "O servidor devolveu uma resposta inválida.");
}

function isInvitationRole(value: unknown): value is NonNullable<AuthInvitation["role"]> {
  return value === "admin" || value === "staff" || value === "client" || value === "member";
}

function isInvitationStatus(value: unknown): value is AuthInvitation["status"] {
  return value === "pending" || value === "accepted" || value === "revoked" || value === "expired";
}

export async function parseInvitationDetailsResponse(
  response: Response,
  expectedKind: AuthInvitation["kind"],
): Promise<AuthInvitation | null> {
  const payload = await readPayload(response);
  assertSuccessfulResponse(response, payload);
  if (payload === null) return null;
  if (
    !isObject(payload)
    || typeof payload.id !== "string"
    || payload.id.length === 0
    || typeof payload.email !== "string"
    || payload.email.length === 0
    || !isInvitationStatus(payload.status)
    || typeof payload.expiresAt !== "string"
    || !Number.isFinite(Date.parse(payload.expiresAt))
    || payload.kind !== expectedKind
    || (payload.organizationName !== undefined && typeof payload.organizationName !== "string")
    || (payload.role !== undefined && !isInvitationRole(payload.role))
  ) {
    throw new Error("O servidor devolveu uma resposta inválida.");
  }
  return {
    id: payload.id,
    email: payload.email,
    status: payload.status,
    expiresAt: payload.expiresAt,
    kind: expectedKind,
    ...(payload.organizationName === undefined ? {} : { organizationName: payload.organizationName }),
    ...(payload.role === undefined ? {} : { role: payload.role }),
  };
}

export async function parseInvitationRegisterResponse(response: Response): Promise<{ email: string }> {
  const payload = await readPayload(response);
  assertSuccessfulResponse(response, payload);
  if (!isObject(payload) || !isObject(payload.data) || typeof payload.data.email !== "string") {
    throw new Error("O servidor devolveu uma resposta inválida.");
  }
  return { email: payload.data.email };
}

export async function parseInvitationAcceptResponse(response: Response): Promise<void> {
  const payload = await readPayload(response);
  assertSuccessfulResponse(response, payload);
  if (
    !isObject(payload)
    || !isObject(payload.data)
    || typeof payload.data.organizationId !== "string"
  ) {
    throw new Error("O servidor devolveu uma resposta inválida.");
  }
}
