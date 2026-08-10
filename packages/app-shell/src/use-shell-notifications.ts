"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createLatestRequestController,
  isAbortError,
  observedFetch,
  type UiRequestMetricObserver,
} from "@brightweblabs/infra/request-observability";
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
  requestObserver?: UiRequestMetricObserver;
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
  requestObserver,
}: UseShellNotificationsOptions = {}): AlertsMenuProps {
  const [notifications, setNotifications] = useState<ShellNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [seenAt, setSeenAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);
  const openRef = useRef(false);
  const requestObserverRef = useRef(requestObserver);
  requestObserverRef.current = requestObserver;
  const itemsRequestRef = useRef<Promise<void> | null>(null);
  const summaryRequestRef = useRef<Promise<void> | null>(null);
  const acknowledgementRef = useRef<Promise<void> | null>(null);
  const pendingAcknowledgementRef = useRef<string | null>(null);
  const configurationGenerationRef = useRef(0);
  const itemsRefreshQueuedRef = useRef(false);
  const summaryRefreshQueuedRef = useRef(false);
  const itemsControllerRef = useRef(createLatestRequestController());
  const summaryControllerRef = useRef(createLatestRequestController());

  const loadSummary = useCallback((force = false) => {
    if (!enabled) return Promise.resolve();
    if (summaryRequestRef.current) {
      if (force) summaryRefreshQueuedRef.current = true;
      return summaryRequestRef.current;
    }

    const latest = summaryControllerRef.current.begin();
    let request: Promise<void>;
    request = observedFetch(fetch, `${endpoint}?limit=0`, {
      cache: "no-store",
      signal: latest.signal,
    }, { domain: "notifications", operation: "summary.load", observer: requestObserverRef.current })
      .then(async (response) => {
        const payload = parsePayload(await response.json().catch(() => null));
        if (latest.isCurrent() && response.ok && payload) {
          setUnreadCount(openRef.current ? 0 : payload.unreadCount);
          setSeenAt(payload.seenAt);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        latest.finish();
        if (summaryRequestRef.current !== request) return;
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
    const latest = itemsControllerRef.current.begin();
    let request: Promise<void>;
    request = observedFetch(fetch, `${endpoint}?limit=8`, {
      cache: "no-store",
      signal: latest.signal,
    }, { domain: "notifications", operation: "items.load", observer: requestObserverRef.current })
      .then(async (response) => {
        const raw = await response.json().catch(() => null);
        const payload = parsePayload(raw);
        if (!response.ok || !payload) throw new Error("Não foi possível carregar as notificações.");
        if (!latest.isCurrent()) return;
        loadedRef.current = true;
        setNotifications(payload.items);
        setUnreadCount(openRef.current ? 0 : payload.unreadCount);
        setSeenAt(payload.seenAt);
      })
      .catch((reason) => {
        if (isAbortError(reason) || !latest.isCurrent()) return;
        setNotifications([]);
        setError(reason instanceof Error ? reason.message : "Não foi possível carregar as notificações.");
      })
      .finally(() => {
        const wasCurrent = latest.isCurrent();
        latest.finish();
        if (itemsRequestRef.current !== request) return;
        itemsRequestRef.current = null;
        if (wasCurrent) setLoading(false);
        if (itemsRefreshQueuedRef.current) {
          itemsRefreshQueuedRef.current = false;
          loadedRef.current = false;
          loadNotifications(true);
        }
      });
    itemsRequestRef.current = request;
  }, [enabled, endpoint]);

  const acknowledge = useCallback(() => {
    if (!enabled) return;
    setUnreadCount(0);
    pendingAcknowledgementRef.current = new Date().toISOString();
    if (acknowledgementRef.current) return;

    function flushAcknowledgement() {
      const seenBefore = pendingAcknowledgementRef.current;
      if (!seenBefore) return;
      pendingAcknowledgementRef.current = null;
      const configurationGeneration = configurationGenerationRef.current;
      let request: Promise<void>;
      request = observedFetch(fetch, endpoint, {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seenBefore }),
      }, { domain: "notifications", operation: "acknowledge", observer: requestObserverRef.current })
        .then((response) => {
          if (!response.ok) throw new Error("acknowledgement failed");
        })
        .catch(() => undefined)
        .then(() => {
          if (configurationGeneration !== configurationGenerationRef.current) return;
          return loadSummary(true);
        })
        .finally(() => {
          if (acknowledgementRef.current !== request) return;
          acknowledgementRef.current = null;
          if (
            pendingAcknowledgementRef.current
            && configurationGeneration === configurationGenerationRef.current
          ) flushAcknowledgement();
        });
      acknowledgementRef.current = request;
    }

    flushAcknowledgement();
  }, [enabled, endpoint, loadSummary]);

  const handleOpenChange = useCallback((open: boolean) => {
    openRef.current = open;
    if (open) {
      setUnreadCount(0);
      loadNotifications();
      return;
    }
    itemsRefreshQueuedRef.current = false;
    itemsControllerRef.current.abort();
    itemsRequestRef.current = null;
    setLoading(false);
    acknowledge();
    loadedRef.current = false;
  }, [acknowledge, loadNotifications]);

  const dismiss = useCallback((notificationId: string) => {
    setNotifications((current) => current.filter((notification) => notification.id !== notificationId));
    setUnreadCount((current) => Math.max(0, current - 1));
    void observedFetch(fetch, endpoint, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: notificationId }),
    }, { domain: "notifications", operation: "dismiss", observer: requestObserverRef.current })
      .then((response) => { if (!response.ok) throw new Error("dismiss failed"); })
      .catch(() => { loadedRef.current = false; loadNotifications(true); });
  }, [endpoint, loadNotifications]);

  const dismissAll = useCallback(() => {
    const seenAtMs = seenAt ? new Date(seenAt).getTime() : null;
    const eventIds = notifications
      .filter((notification) => {
        if (seenAtMs === null || !Number.isFinite(seenAtMs)) return true;
        const createdAt = new Date(notification.createdAt).getTime();
        return !Number.isFinite(createdAt) || createdAt > seenAtMs;
      })
      .map((notification) => notification.id);
    if (eventIds.length === 0) return;
    const dismissedIds = new Set(eventIds);
    setNotifications((current) => current.filter((notification) => !dismissedIds.has(notification.id)));
    setUnreadCount((current) => Math.max(0, current - eventIds.length));
    void observedFetch(fetch, endpoint, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventIds }),
    }, { domain: "notifications", operation: "dismiss.all", observer: requestObserverRef.current })
      .then((response) => { if (!response.ok) throw new Error("dismiss all failed"); })
      .catch(() => { loadedRef.current = false; loadNotifications(true); });
  }, [endpoint, loadNotifications, notifications, seenAt]);

  useEffect(() => {
    const configurationGeneration = ++configurationGenerationRef.current;
    if (!enabled) {
      openRef.current = false;
      loadedRef.current = false;
      itemsRefreshQueuedRef.current = false;
      summaryRefreshQueuedRef.current = false;
      itemsControllerRef.current.abort();
      summaryControllerRef.current.abort();
      itemsRequestRef.current = null;
      summaryRequestRef.current = null;
      acknowledgementRef.current = null;
      pendingAcknowledgementRef.current = null;
      setNotifications([]);
      setUnreadCount(0);
      setSeenAt(null);
      setLoading(false);
      setError(null);
      return () => {
        if (configurationGenerationRef.current === configurationGeneration) configurationGenerationRef.current += 1;
      };
    }
    void loadSummary();
    if (openRef.current) loadNotifications(true);
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
      itemsRefreshQueuedRef.current = false;
      summaryRefreshQueuedRef.current = false;
      loadedRef.current = false;
      itemsControllerRef.current.abort();
      summaryControllerRef.current.abort();
      itemsRequestRef.current = null;
      summaryRequestRef.current = null;
      acknowledgementRef.current = null;
      pendingAcknowledgementRef.current = null;
      if (configurationGenerationRef.current === configurationGeneration) configurationGenerationRef.current += 1;
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
    onDismiss: dismiss,
    onDismissAll: dismissAll,
  };
}
