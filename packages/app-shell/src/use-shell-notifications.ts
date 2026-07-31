"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AlertsMenuProps, ShellNotification } from "./components/alerts-menu";
import { NOTIFICATIONS_REALTIME_REFRESH_EVENT } from "./realtime";

type NotificationsPayload = {
  items: ShellNotification[];
  unreadCount: number;
  seenAt: string | null;
};

export type UseShellNotificationsOptions = {
  enabled?: boolean;
  endpoint?: string;
  refreshIntervalMs?: number;
};

function parsePayload(value: unknown): NotificationsPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  if (!Array.isArray(payload.items) || typeof payload.unreadCount !== "number") return null;
  const items = payload.items.filter((item): item is ShellNotification => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const row = item as Record<string, unknown>;
    return typeof row.id === "string"
      && typeof row.summary === "string"
      && typeof row.createdAt === "string"
      && (row.domain === undefined || typeof row.domain === "string")
      && (row.eventType === undefined || typeof row.eventType === "string")
      && (row.actorProfileId === undefined || row.actorProfileId === null || typeof row.actorProfileId === "string")
      && (row.actorLabel === undefined || row.actorLabel === null || typeof row.actorLabel === "string")
      && (row.payload === undefined || (typeof row.payload === "object" && row.payload !== null && !Array.isArray(row.payload)));
  });
  return {
    items,
    unreadCount: Math.max(0, payload.unreadCount),
    seenAt: typeof payload.seenAt === "string" ? payload.seenAt : null,
  };
}

export function useShellNotifications({
  enabled = true,
  endpoint = "/api/notifications",
  refreshIntervalMs = 30_000,
}: UseShellNotificationsOptions = {}): AlertsMenuProps {
  const [notifications, setNotifications] = useState<ShellNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [seenAt, setSeenAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);
  const openRef = useRef(false);
  const itemsRequestRef = useRef<Promise<void> | null>(null);
  const summaryRequestRef = useRef<Promise<void> | null>(null);
  const acknowledgementRef = useRef<Promise<void> | null>(null);
  const unreadBeforeOpenRef = useRef(0);
  const itemsRefreshQueuedRef = useRef(false);
  const summaryRefreshQueuedRef = useRef(false);

  const loadSummary = useCallback((force = false) => {
    if (!enabled) return Promise.resolve();
    if (summaryRequestRef.current) {
      if (force) summaryRefreshQueuedRef.current = true;
      return summaryRequestRef.current;
    }

    const request = fetch(`${endpoint}?limit=0`, { cache: "no-store" })
      .then(async (response) => {
        const payload = parsePayload(await response.json().catch(() => null));
        if (response.ok && payload) {
          setUnreadCount(payload.unreadCount);
          setSeenAt(payload.seenAt);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        summaryRequestRef.current = null;
        if (summaryRefreshQueuedRef.current) {
          summaryRefreshQueuedRef.current = false;
          void loadSummary(true);
        }
      });
    summaryRequestRef.current = request;
    return request;
  }, [enabled, endpoint]);

  const loadNotifications = useCallback((force = false) => {
    if (!enabled) return;
    if (itemsRequestRef.current) {
      if (force) itemsRefreshQueuedRef.current = true;
      return;
    }
    if (loadedRef.current && !force) return;
    setLoading(true);
    setError(null);
    const request = fetch(`${endpoint}?limit=8`, { cache: "no-store" })
      .then(async (response) => {
        const raw = await response.json().catch(() => null);
        const payload = parsePayload(raw);
        if (!response.ok || !payload) throw new Error("Não foi possível carregar as notificações.");
        loadedRef.current = true;
        setNotifications(payload.items);
        setUnreadCount(payload.unreadCount);
        setSeenAt(payload.seenAt);
      })
      .catch((reason) => {
        setNotifications([]);
        setError(reason instanceof Error ? reason.message : "Não foi possível carregar as notificações.");
      })
      .finally(() => {
        itemsRequestRef.current = null;
        setLoading(false);
        if (itemsRefreshQueuedRef.current) {
          itemsRefreshQueuedRef.current = false;
          loadedRef.current = false;
          loadNotifications(true);
        }
      });
    itemsRequestRef.current = request;
  }, [enabled, endpoint]);

  const acknowledge = useCallback(() => {
    if (!enabled || acknowledgementRef.current) return;
    const previousCount = unreadBeforeOpenRef.current;
    const seenBefore = new Date().toISOString();
    setUnreadCount(0);
    const request = fetch(endpoint, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seenBefore }),
    })
      .then((response) => {
        if (!response.ok) throw new Error("acknowledgement failed");
      })
      .then(() => loadSummary(true))
      .catch(() => setUnreadCount((current) => current === 0 ? previousCount : current))
      .finally(() => {
        acknowledgementRef.current = null;
      });
    acknowledgementRef.current = request;
  }, [enabled, endpoint, loadSummary]);

  const handleOpenChange = useCallback((open: boolean) => {
    openRef.current = open;
    if (open) {
      unreadBeforeOpenRef.current = unreadCount;
      setUnreadCount(0);
      loadNotifications();
      return;
    }
    acknowledge();
    loadedRef.current = false;
  }, [acknowledge, loadNotifications, unreadCount]);

  useEffect(() => {
    if (!enabled) return;
    void loadSummary();
    const interval = window.setInterval(loadSummary, refreshIntervalMs);
    const handleFocus = () => void loadSummary();
    const handleRealtimeRefresh = () => {
      loadedRef.current = false;
      void loadSummary(true);
      if (openRef.current) loadNotifications(true);
    };
    window.addEventListener("focus", handleFocus);
    window.addEventListener(NOTIFICATIONS_REALTIME_REFRESH_EVENT, handleRealtimeRefresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener(NOTIFICATIONS_REALTIME_REFRESH_EVENT, handleRealtimeRefresh);
    };
  }, [enabled, loadNotifications, loadSummary, refreshIntervalMs]);

  return {
    notifications,
    unreadCount,
    seenAt,
    loading,
    error,
    onLoad: loadNotifications,
    onOpenChange: handleOpenChange,
  };
}
