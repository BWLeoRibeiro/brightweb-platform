import type { User } from "@supabase/supabase-js";
import { publicError, sanitizePublicError } from "@brightweblabs/infra/robustness";
import {
  ACCOUNT_LANGUAGES,
  type AccountLanguage,
  type getCurrentAccountProfile,
  type updateCurrentAccountProfile,
} from "./profile";

type AccountAccess =
  | { ok: true; supabase: unknown; user: User; profileId: string; role: string | null }
  | { ok: false; status: number; error: string };

type AccountHttpDependencies = {
  getAccess(): Promise<AccountAccess>;
  getProfile: typeof getCurrentAccountProfile;
  updateProfile: typeof updateCurrentAccountProfile;
};

function json(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseLanguage(value: unknown): AccountLanguage | null {
  if (typeof value !== "string") return null;
  return ACCOUNT_LANGUAGES.includes(value as AccountLanguage) ? value as AccountLanguage : null;
}

function normalizeInputText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function accessError(access: Extract<AccountAccess, { ok: false }>) {
  return json(publicError("ACCESS_DENIED", access.error), { status: access.status });
}

function accountError(error: unknown, context: string) {
  return json(
    sanitizePublicError(error, {}, "Não foi possível concluir o pedido da conta.", context),
    { status: 500 },
  );
}

export function createAccountGetHandler(dependencies: AccountHttpDependencies) {
  return async function handleAccountGetRequest(_request: Request): Promise<Response> {
    const access = await dependencies.getAccess();
    if (!access.ok) return accessError(access);

    try {
      const profile = await dependencies.getProfile(
        access.supabase as never,
        access.user.id,
        access.user.email ?? null,
      );
      if (!profile.ok) throw new Error(profile.error);
      return json({ data: profile.data });
    } catch (error) {
      return accountError(error, "account.profile.get");
    }
  };
}

export function createAccountUpdateHandler(dependencies: AccountHttpDependencies) {
  return async function handleAccountUpdateRequest(request: Request): Promise<Response> {
    const access = await dependencies.getAccess();
    if (!access.ok) return accessError(access);

    const body: unknown = await request.json().catch(() => null);
    if (!isRecord(body)) {
      return json(publicError("INVALID_PAYLOAD", "Payload inválido."), { status: 400 });
    }

    const firstName = normalizeInputText(body.firstName);
    const lastName = normalizeInputText(body.lastName);
    const preferredLanguage = parseLanguage(body.preferredLanguage);

    if (firstName.length > 80 || lastName.length > 80) {
      return json(
        publicError("INVALID_NAME", "Nome inválido. Limite máximo de 80 caracteres por campo."),
        { status: 400 },
      );
    }
    if (!preferredLanguage) {
      return json(publicError("INVALID_LANGUAGE", "Idioma inválido."), { status: 400 });
    }

    try {
      const profile = await dependencies.updateProfile(access.supabase as never, access.user, {
        firstName,
        lastName,
        preferredLanguage,
      });
      if (!profile.ok) throw new Error(profile.error);
      return json({ data: profile.data });
    } catch (error) {
      return accountError(error, "account.profile.update");
    }
  };
}
