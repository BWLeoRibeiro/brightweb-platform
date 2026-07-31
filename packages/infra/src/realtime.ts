"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "./client";

export type AppActivityEventRow = {
  id: string;
  created_at: string;
  domain: string;
  event_type: string;
  entity_table: string;
  entity_id: string | null;
  actor_profile_id: string | null;
  summary: string;
  payload: Record<string, unknown> | null;
};

export type AppActivityRealtimePayload = {
  commit_timestamp: string;
  errors: string[] | null;
  eventType: "INSERT";
  new: AppActivityEventRow;
  old: Record<string, never>;
  schema: string;
  table: string;
};

export type AppActivitySubscriptionOptions = {
  channelName?: string;
  domains?: readonly string[];
  onInsert: (payload: AppActivityRealtimePayload) => void;
  onAuth?: (state: "AUTHENTICATED" | "NO_SESSION") => void;
  onStatus?: (status: string, error?: Error) => void;
  supabase?: SupabaseClient;
};

function uniqueDomains(domains: readonly string[] | undefined) {
  return Array.from(
    new Set((domains ?? []).map((domain) => domain.trim()).filter(Boolean))
  );
}

/**
 * Subscribes to the shared activity-event stream. Payloads are invalidation
 * hints only; callers must refetch authoritative data after receiving one.
 */
export function subscribeToAppActivityEvents({
  channelName = "brightweb:app-activity-events",
  domains,
  onInsert,
  onAuth,
  onStatus,
  supabase = createBrowserSupabaseClient(),
}: AppActivitySubscriptionOptions) {
  const subscribedDomains = uniqueDomains(domains);
  let channels: RealtimeChannel[] = [];
  let cancelled = false;

  void (async () => {
    const { data, error } = await supabase.auth.getSession();
    if (cancelled) return;

    if (error) {
      onStatus?.("AUTH_ERROR", error);
      return;
    }

    const token = data.session?.access_token;
    if (!token) {
      onAuth?.("NO_SESSION");
      onStatus?.("NO_SESSION");
      return;
    }

    onAuth?.("AUTHENTICATED");
    await supabase.realtime.setAuth(token);
    if (cancelled) return;

    const channelConfigs =
      subscribedDomains.length > 0
        ? subscribedDomains.map((domain) => ({
            channelName:
              subscribedDomains.length === 1
                ? channelName
                : `${channelName}:${domain}`,
            domain,
            filter: `domain=eq.${domain}`,
          }))
        : [{ channelName, domain: undefined, filter: undefined }];

    channels = channelConfigs.map((config) =>
      supabase
        .channel(config.channelName)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "app_activity_events",
            ...(config.filter ? { filter: config.filter } : {}),
          },
          (payload) => {
            const activityPayload = payload as AppActivityRealtimePayload;
            if (!config.domain || activityPayload.new.domain === config.domain)
              onInsert(activityPayload);
          }
        )
        .subscribe((status, channelError) => onStatus?.(status, channelError))
    );
  })().catch((error) => {
    if (!cancelled) {
      onStatus?.(
        "ERROR",
        error instanceof Error
          ? error
          : new Error("Realtime subscription failed.")
      );
    }
  });

  return () => {
    cancelled = true;
    for (const channel of channels) void supabase.removeChannel(channel);
    channels = [];
  };
}
