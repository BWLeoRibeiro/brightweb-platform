import { useEffect } from "react";
import { useShellAction } from "@brightweblabs/app-shell";
import {
  PROJECTS_EVENTS,
  dispatchProjectsCustomEvent,
  type ProjectsHealthFilter,
  type ProjectsRefreshEventDetail,
  type ProjectsStateEventDetail,
  type ProjectsStatusFilter,
} from "../events";

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
  useShellAction<ProjectsRefreshEventDetail | undefined>(PROJECTS_EVENTS.refresh, (detail) => {
    onRefresh(detail);
  });

  useShellAction<{ query?: string } | undefined>(PROJECTS_EVENTS.setSearch, (detail) => {
    onSetSearch(detail?.query ?? "");
  });

  useShellAction<{ status?: ProjectsStatusFilter } | undefined>(PROJECTS_EVENTS.setStatus, (detail) => {
    onSetStatus(detail?.status ?? "all");
  });

  useShellAction<{ health?: ProjectsHealthFilter } | undefined>(PROJECTS_EVENTS.setHealth, (detail) => {
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
