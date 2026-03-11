import { requireServerRoleAccess } from "@brightweblabs/core-auth/server";
import { applyAdminRoleChanges } from "./roles";
import {
  ADMIN_USERS_DEFAULT_PAGE_SIZE,
  ADMIN_USERS_MAX_PAGE_SIZE,
  listAdminUsers,
  type AdminManagedRole,
} from "./users";

function json(body: unknown, init?: ResponseInit) {
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

function normalizeRoleFilter(value: string | null): AdminManagedRole | null {
  if (value === "client" || value === "staff" || value === "admin") {
    return value;
  }

  return null;
}

export async function handleAdminUsersGetRequest(request: Request): Promise<Response> {
  const access = await requireServerRoleAccess("admin");
  if (!access.ok) {
    return json({ error: access.error }, { status: access.status });
  }

  const url = new URL(request.url);
  const page = parsePositiveInteger(url.searchParams.get("page"), 1);
  const pageSize = Math.min(
    parsePositiveInteger(url.searchParams.get("pageSize"), ADMIN_USERS_DEFAULT_PAGE_SIZE),
    ADMIN_USERS_MAX_PAGE_SIZE,
  );
  const search = url.searchParams.get("search")?.trim() ?? "";
  const roleFilter = normalizeRoleFilter(url.searchParams.get("role"));

  try {
    const result = await listAdminUsers({
      supabase: access.supabase,
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
}

export async function handleAdminUsersRoleChangeRequest(request: Request): Promise<Response> {
  const access = await requireServerRoleAccess("admin");
  if (!access.ok) {
    return json({ error: access.error }, { status: access.status });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Pedido inválido." }, { status: 400 });
  }

  const profileIds = Array.isArray((payload as { profileIds?: unknown })?.profileIds)
    ? (payload as { profileIds: unknown[] }).profileIds.filter(
        (value): value is string => typeof value === "string" && value.trim().length > 0,
      )
    : [];
  const newRole = normalizeRoleFilter((payload as { newRole?: string | null })?.newRole ?? null);
  const reason = typeof (payload as { reason?: unknown })?.reason === "string"
    ? (payload as { reason: string }).reason.trim()
    : "";

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
    const result = await applyAdminRoleChanges({
      supabase: access.supabase,
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
}
