"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AlertsMenuProps, ShellNotification } from "./components/alerts-menu";

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
      && (row.domain === undefined || typeof row.domain === "string");
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);
  const openRef = useRef(false);
  const itemsRequestRef = useRef<Promise<void> | null>(null);
  const summaryRequestRef = useRef<Promise<void> | null>(null);
  const acknowledgementRef = useRef<Promise<void> | null>(null);

  const loadSummary = useCallback(() => {
    if (!enabled) return Promise.resolve();
    if (summaryRequestRef.current) return summaryRequestRef.current;

    const request = fetch(`${endpoint}?limit=0`, { cache: "no-store" })
      .then(async (response) => {
        const payload = parsePayload(await response.json().catch(() => null));
        if (response.ok && payload) setUnreadCount(payload.unreadCount);
      })
      .catch(() => undefined)
      .finally(() => {
        summaryRequestRef.current = null;
      });
    summaryRequestRef.current = request;
    return request;
  }, [enabled, endpoint]);

  const loadNotifications = useCallback(() => {
    if (!enabled || loadedRef.current || itemsRequestRef.current) return;
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
      })
      .catch((reason) => {
        setNotifications([]);
        setError(reason instanceof Error ? reason.message : "Não foi possível carregar as notificações.");
      })
      .finally(() => {
        itemsRequestRef.current = null;
        setLoading(false);
      });
    itemsRequestRef.current = request;
  }, [enabled, endpoint]);

  const acknowledge = useCallback(() => {
    if (!enabled || acknowledgementRef.current) return;
    const previousCount = unreadCount;
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
      .then(loadSummary)
      .catch(() => setUnreadCount((current) => current === 0 ? previousCount : current))
      .finally(() => {
        acknowledgementRef.current = null;
      });
    acknowledgementRef.current = request;
  }, [enabled, endpoint, loadSummary, unreadCount]);

  const handleOpenChange = useCallback((open: boolean) => {
    openRef.current = open;
    if (open) {
      setUnreadCount(0);
      loadNotifications();
      return;
    }
    acknowledge();
    loadedRef.current = false;
  }, [acknowledge, loadNotifications]);

  useEffect(() => {
    if (!enabled) return;
    void loadSummary();
    const interval = window.setInterval(loadSummary, refreshIntervalMs);
    const handleFocus = () => void loadSummary();
    const handleRealtimeRefresh = () => {
      loadedRef.current = false;
      void loadSummary();
      if (openRef.current) loadNotifications();
    };
    window.addEventListener("focus", handleFocus);
    window.addEventListener("brightweb:notifications:refresh", handleRealtimeRefresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("brightweb:notifications:refresh", handleRealtimeRefresh);
    };
  }, [enabled, loadNotifications, loadSummary, refreshIntervalMs]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    onLoad: loadNotifications,
    onOpenChange: handleOpenChange,
  };
}
