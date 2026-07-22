import { useEffect } from "react";
import {
  PROJECTS_EVENTS,
  dispatchProjectsCustomEvent,
  type ProjectsHealthFilter,
  type ProjectsRefreshEventDetail,
  type ProjectsStateEventDetail,
  type ProjectsStatusFilter,
} from "../events";
import { useWindowEventBridge } from "../window-events";

type UseProjectsWindowEventsParams = {
  search: string;
  status: ProjectsStatusFilter;
  health: ProjectsHealthFilter;
  isLoading: boolean;
  total: number;
  onRefresh: (detail?: ProjectsRefreshEventDetail) => void;
  onSetSearch: (query: string) => void;
  onSetStatus: (status: ProjectsStatusFilter) => void;
  onSetHealth: (health: ProjectsHealthFilter) => void;
};

export function useProjectsWindowEvents({
  search,
  status,
  health,
  isLoading,
  total,
  onRefresh,
  onSetSearch,
  onSetStatus,
  onSetHealth,
}: UseProjectsWindowEventsParams) {
  useWindowEventBridge<ProjectsRefreshEventDetail | undefined>(PROJECTS_EVENTS.refresh, (detail) => {
    onRefresh(detail);
  });

  useWindowEventBridge<{ query?: string }>(PROJECTS_EVENTS.setSearch, (detail) => {
    onSetSearch(detail?.query ?? "");
  });

  useWindowEventBridge<{ status?: ProjectsStatusFilter }>(PROJECTS_EVENTS.setStatus, (detail) => {
    onSetStatus(detail?.status ?? "all");
  });

  useWindowEventBridge<{ health?: ProjectsHealthFilter }>(PROJECTS_EVENTS.setHealth, (detail) => {
    onSetHealth(detail?.health ?? "all");
  });

  useEffect(() => {
    const detail: ProjectsStateEventDetail = {
      search,
      status,
      health,
      isLoading,
      total,
    };
    dispatchProjectsCustomEvent(PROJECTS_EVENTS.state, detail);
  }, [health, isLoading, search, status, total]);
}
