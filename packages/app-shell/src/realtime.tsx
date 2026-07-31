"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  subscribeToAppActivityEvents,
  type AppActivityRealtimePayload,
} from "@brightweblabs/infra/realtime";
import {
  DASHBOARD_EVENTS,
  mergeDashboardRefreshEventDetails,
  type DashboardRefreshEventDetail,
} from "./dashboard/events";

export const APP_ACTIVITY_REALTIME_EVENT = "brightweb:realtime:activity";
export const NOTIFICATIONS_REALTIME_REFRESH_EVENT =
  "brightweb:notifications:refresh";
export const CRM_REALTIME_REFRESH_EVENT = "brightweb:crm:refresh";
export const ADMIN_REALTIME_REFRESH_EVENT = "admin:refresh";
export const PROJECTS_REALTIME_REFRESH_EVENT = "projects:refresh";

export type ShellRealtimeViewer = {
  profileId: string | null;
  isAdmin: boolean;
  isStaff: boolean;
};

export type ShellRealtimeBridgeProps = {
  enabled?: boolean;
  viewer: ShellRealtimeViewer;
};

type ProjectRouteContext =
  | {
      baseHref: string;
      projectId: null;
      surface: "portfolio";
    }
  | {
      baseHref: string;
      projectId: string;
      surface: "detail";
    };

function dispatchCustomEvent<T>(name: string, detail: T) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0
      )
    : [];
}

function eventPayload(payload: AppActivityRealtimePayload) {
  return payload.new.payload && typeof payload.new.payload === "object"
    ? payload.new.payload
    : {};
}

export function getRealtimeProjectId(payload: AppActivityRealtimePayload) {
  if (payload.new.domain !== "projects") return null;
  const projectId = readString(eventPayload(payload).project_id);
  if (projectId) return projectId;
  return payload.new.entity_table === "projects"
    ? readString(payload.new.entity_id)
    : null;
}

export function isRealtimeProjectDeleted(payload: AppActivityRealtimePayload) {
  return (
    payload.new.domain === "projects" &&
    (payload.new.event_type === "project_deleted" ||
      payload.new.event_type === "projects.project.deleted")
  );
}

export function isRealtimeProjectAccessRemoved(
  payload: AppActivityRealtimePayload,
  profileId: string | null
) {
  if (!profileId || payload.new.domain !== "projects") return false;
  const data = eventPayload(payload);
  if (payload.new.event_type === "project_members_synced") {
    return readStringArray(data.removed_profile_ids).includes(profileId);
  }
  return (
    payload.new.event_type === "member_removed" &&
    readString(data.profile_id) === profileId
  );
}

export function getProjectRouteContext(
  pathname: string
): ProjectRouteContext | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] === "account" && segments[1] === "projetos") {
    return segments[2]
      ? {
          baseHref: "/account/projetos",
          projectId: segments[2],
          surface: "detail",
        }
      : {
          baseHref: "/account/projetos",
          projectId: null,
          surface: "portfolio",
        };
  }
  if (segments[0] !== "projetos" && segments[0] !== "projects") return null;
  const baseHref = `/${segments[0]}`;
  return segments[1]
    ? {
        baseHref,
        projectId: segments[1],
        surface: "detail",
      }
    : {
        baseHref,
        projectId: null,
        surface: "portfolio",
      };
}

export function getRealtimeProjectRoutePayloads(
  payloads: readonly AppActivityRealtimePayload[],
  projectId: string
) {
  return payloads.filter((payload) => {
    const eventProjectId = getRealtimeProjectId(payload);
    return !eventProjectId || eventProjectId === projectId;
  });
}

/**
 * One authenticated activity stream fans out invalidation hints to every
 * mounted platform surface. Receiving modules always refetch authoritative data.
 */
export function ShellRealtimeBridge({
  enabled = true,
  viewer,
}: ShellRealtimeBridgeProps) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const pathnameRef = useRef(pathname);
  const projectPayloadsRef = useRef<AppActivityRealtimePayload[]>([]);
  const dashboardDetailRef = useRef<DashboardRefreshEventDetail | null>(null);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!enabled) return;

    const timers = new Map<string, number>();
    const schedule = (key: string, callback: () => void, delay = 250) => {
      const current = timers.get(key);
      if (current !== undefined) window.clearTimeout(current);
      timers.set(
        key,
        window.setTimeout(() => {
          timers.delete(key);
          callback();
        }, delay)
      );
    };

    const scheduleDashboardRefresh = (detail: DashboardRefreshEventDetail) => {
      dashboardDetailRef.current = mergeDashboardRefreshEventDetails(
        dashboardDetailRef.current,
        detail
      );
      schedule("dashboard", () => {
        const pending = dashboardDetailRef.current;
        dashboardDetailRef.current = null;
        if (pathnameRef.current === "/dashboard" && pending) {
          dispatchCustomEvent(DASHBOARD_EVENTS.refresh, pending);
        }
      });
    };

    const scheduleProjectRefresh = (payload: AppActivityRealtimePayload) => {
      projectPayloadsRef.current.push(payload);
      schedule("projects", () => {
        const pending = projectPayloadsRef.current;
        projectPayloadsRef.current = [];
        if (pending.length === 0) return;

        const route = getProjectRouteContext(pathnameRef.current);
        if (!route) return;

        if (route.surface === "portfolio") {
          if (route.baseHref.startsWith("/account/")) router.refresh();
          else
            dispatchCustomEvent(PROJECTS_REALTIME_REFRESH_EVENT, {
              source: "realtime",
            });
          return;
        }

        const routePayloads = getRealtimeProjectRoutePayloads(
          pending,
          route.projectId
        );
        if (routePayloads.length === 0) return;

        if (
          routePayloads.some(
            (event) =>
              isRealtimeProjectDeleted(event) ||
              isRealtimeProjectAccessRemoved(event, viewer.profileId)
          )
        ) {
          router.replace(route.baseHref);
          return;
        }
        router.refresh();
      });
    };

    document.documentElement.dataset.brightwebRealtimeStatus = "CONNECTING";
    delete document.documentElement.dataset.brightwebRealtimeError;

    const unsubscribe = subscribeToAppActivityEvents({
      // Project clients only need project changes. Staff subscribe without a
      // client filter so newly added platform domains work by default.
      domains: viewer.isStaff ? undefined : ["projects"],
      onInsert: (payload) => {
        const count = Number.parseInt(
          document.documentElement.dataset.brightwebRealtimeEventCount ?? "0",
          10
        );
        document.documentElement.dataset.brightwebRealtimeEventCount = String(
          Number.isFinite(count) ? count + 1 : 1
        );
        document.documentElement.dataset.brightwebRealtimeLastEventAt =
          new Date().toISOString();
        document.documentElement.dataset.brightwebRealtimeLastDomain =
          payload.new.domain;
        document.documentElement.dataset.brightwebRealtimeLastEventType =
          payload.new.event_type;

        dispatchCustomEvent(APP_ACTIVITY_REALTIME_EVENT, payload);

        if (viewer.isStaff) {
          schedule(
            "notifications",
            () => {
              window.dispatchEvent(
                new Event(NOTIFICATIONS_REALTIME_REFRESH_EVENT)
              );
            },
            100
          );
        }

        if (payload.new.domain === "crm" && viewer.isStaff) {
          schedule("crm", () => {
            if (pathnameRef.current === "/crm") {
              dispatchCustomEvent(CRM_REALTIME_REFRESH_EVENT, {
                source: "realtime",
              });
            }
          });
          scheduleDashboardRefresh({
            source: "realtime",
            domain: "crm",
            eventType: payload.new.event_type,
            sections: ["crm"],
          });
        }

        if (payload.new.domain === "admin" && viewer.isAdmin) {
          schedule("admin", () => {
            if (
              pathnameRef.current === "/admin" ||
              pathnameRef.current.startsWith("/admin/")
            ) {
              window.dispatchEvent(new Event(ADMIN_REALTIME_REFRESH_EVENT));
            }
          });
        }

        if (payload.new.domain === "projects") {
          scheduleProjectRefresh(payload);
          if (viewer.isStaff) {
            scheduleDashboardRefresh({
              source: "realtime",
              domain: "projects",
              eventType: payload.new.event_type,
              sections: ["projects", "tasks"],
            });
          }
        }
      },
      onAuth: (state) => {
        document.documentElement.dataset.brightwebRealtimeAuth = state;
      },
      onStatus: (status, error) => {
        document.documentElement.dataset.brightwebRealtimeStatus = status;
        if (error)
          document.documentElement.dataset.brightwebRealtimeError =
            error.message;
        else delete document.documentElement.dataset.brightwebRealtimeError;
      },
    });

    return () => {
      unsubscribe();
      for (const timer of timers.values()) window.clearTimeout(timer);
      timers.clear();
      projectPayloadsRef.current = [];
      dashboardDetailRef.current = null;
    };
  }, [enabled, router, viewer.isAdmin, viewer.isStaff, viewer.profileId]);

  return null;
}
