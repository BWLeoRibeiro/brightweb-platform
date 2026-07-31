import type { NotificationsResponse } from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 50;

type NotificationAccess =
  | { ok: true; profileId: string }
  | { ok: false; status: number; error: string };

export type NotificationHttpDependencies = {
  getAccess(): Promise<NotificationAccess>;
  getServiceClient(): SupabaseClient;
  now?(): Date;
};

type SummaryRow = {
  seen_at: string | null;
  unread_count: number | string | null;
};

type ItemRow = {
  id: string;
  summary: string;
  created_at: string;
  domain: string;
  event_type?: string;
  actor_profile_id?: string | null;
  payload?: unknown;
};

type NotificationActorRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function readCount(value: SummaryRow["unread_count"] | undefined) {
  const count = typeof value === "string" ? Number(value) : value;
  return typeof count === "number" && Number.isFinite(count) && count > 0 ? count : 0;
}

function readLimit(request: Request) {
  const raw = Number.parseInt(new URL(request.url).searchParams.get("limit") ?? "", 10);
  if (!Number.isFinite(raw)) return DEFAULT_LIMIT;
  return Math.min(Math.max(raw, 0), MAX_LIMIT);
}

function resolveSeenAt(value: unknown, receivedAt: Date) {
  const receivedTime = receivedAt.getTime();
  const fallback = Number.isFinite(receivedTime) ? receivedAt : new Date();
  if (typeof value !== "string") return fallback.toISOString();
  const requested = new Date(value);
  if (!Number.isFinite(requested.getTime()) || requested > fallback) return fallback.toISOString();
  return requested.toISOString();
}

function actorName(profile: NotificationActorRow) {
  return [profile.first_name, profile.last_name].filter((part): part is string => Boolean(part?.trim())).join(" ").trim() || null;
}

async function getSummary(client: SupabaseClient, profileId: string) {
  const { data, error } = await client
    .rpc("current_notification_summary", { p_profile_id: profileId })
    .maybeSingle<SummaryRow>();
  if (error) throw new Error(error.message);
  return {
    unreadCount: readCount(data?.unread_count),
    seenAt: data?.seen_at ?? null,
  };
}

export function createNotificationsGetHandler(dependencies: NotificationHttpDependencies) {
  return async function handleNotificationsGetRequest(request: Request): Promise<Response> {
    const access = await dependencies.getAccess();
    if (!access.ok) return json({ error: access.error }, access.status);

    try {
      const client = dependencies.getServiceClient();
      const limit = readLimit(request);
      const summaryPromise = getSummary(client, access.profileId);
      if (limit === 0) {
        const summary = await summaryPromise;
        return json({ items: [], ...summary } satisfies NotificationsResponse);
      }

      const [summary, itemsResult] = await Promise.all([
        summaryPromise,
        client
          .rpc("current_notification_items", {
            p_profile_id: access.profileId,
            p_limit: limit,
          })
          .overrideTypes<ItemRow[], { merge: false }>(),
      ]);
      if (itemsResult.error) throw new Error(itemsResult.error.message);

      const rows = Array.isArray(itemsResult.data) ? itemsResult.data as ItemRow[] : [];
      const actorIds = Array.from(new Set(rows.map((row) => row.actor_profile_id).filter((id): id is string => typeof id === "string" && id.length > 0)));
      const actorLabels = new Map<string, string>();
      if (actorIds.length > 0) {
        const actorResult = await client
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", actorIds)
          .overrideTypes<NotificationActorRow[], { merge: false }>();
        if (!actorResult.error) {
          for (const profile of actorResult.data ?? []) {
            const label = actorName(profile);
            if (label) actorLabels.set(profile.id, label);
          }
        }
      }
      const items = rows.map((row) => ({
        id: row.id,
        summary: row.summary,
        createdAt: row.created_at,
        domain: row.domain,
        eventType: row.event_type,
        actorProfileId: row.actor_profile_id ?? null,
        actorLabel: row.actor_profile_id ? actorLabels.get(row.actor_profile_id) ?? null : null,
        payload: row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
          ? row.payload as Record<string, unknown>
          : {},
      }));
      return json({ items, ...summary } satisfies NotificationsResponse);
    } catch (error) {
      console.error("[core-auth.notifications.get]", error);
      return json({ error: "Não foi possível carregar as notificações." }, 503);
    }
  };
}

export function createNotificationsPostHandler(dependencies: NotificationHttpDependencies) {
  return async function handleNotificationsPostRequest(request: Request): Promise<Response> {
    const receivedAt = dependencies.now?.() ?? new Date();
    const access = await dependencies.getAccess();
    if (!access.ok) return json({ error: access.error }, access.status);

    const body = await request.json().catch(() => null);
    const requestedAt = body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).seenBefore
      : undefined;
    const seenAt = resolveSeenAt(requestedAt, receivedAt);

    try {
      const { error } = await dependencies.getServiceClient()
        .from("user_notification_state")
        .upsert(
          { profile_id: access.profileId, alerts_seen_at: seenAt },
          { onConflict: "profile_id" },
        );
      if (error) throw new Error(error.message);
      return json({ seenAt });
    } catch (error) {
      console.error("[core-auth.notifications.post]", error);
      return json({ error: "Não foi possível atualizar as notificações." }, 503);
    }
  };
}

export { resolveSeenAt as resolveNotificationSeenAt };
