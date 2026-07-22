"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  PROJECTS_EVENTS,
  dispatchProjectsEvent,
  type ProjectsRefreshEventDetail,
  type ProjectsHealthFilter,
  type ProjectsStatusFilter,
} from "../events";
import type { ListProjectsPayload } from "../projects-list-response-parser";
import { useProjectsUiClient } from "../context";

const PAGE_SIZE = 12;

type UseProjectsPortfolioControllerOptions = {
  initialUpdatedAt?: string | null;
  loadOnMount?: boolean;
};

export function useProjectsPortfolioController(
  initialData: ListProjectsPayload,
  options: UseProjectsPortfolioControllerOptions = {},
) {
  const client = useProjectsUiClient();
  const { initialUpdatedAt = null, loadOnMount = false } = options;
  const [data, setData] = useState(initialData);
  const [page, setPage] = useState(Math.max(1, initialData.page || 1));
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ProjectsStatusFilter>("all");
  const [health, setHealth] = useState<ProjectsHealthFilter>("all");
  const [isLoading, setIsLoading] = useState(loadOnMount);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(initialUpdatedAt);
  const requestAbortRef = useRef<AbortController | null>(null);
  const hasMountedRef = useRef(false);
  const hasActiveFilters = Boolean(search.trim()) || status !== "all" || health !== "all";
  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  const loadProjects = useCallback(async () => {
    requestAbortRef.current?.abort();
    const controller = new AbortController();
    requestAbortRef.current = controller;

    setIsLoading(true);
    try {
      const next = await client.listProjects({ page, pageSize: PAGE_SIZE, dueWindow: "all", search: search.trim() || undefined, status: status === "all" ? null : status, health: health === "all" ? null : health });
      if (requestAbortRef.current !== controller) return false;
      setData(next);
      setLastUpdatedAt(new Date().toISOString());
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return false;
      if (requestAbortRef.current !== controller) return false;
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar projetos.");
      return false;
    } finally {
      if (requestAbortRef.current !== controller) return;
      requestAbortRef.current = null;
      setIsLoading(false);
      dispatchProjectsEvent(PROJECTS_EVENTS.refreshComplete);
    }
  }, [client, health, page, search, status]);

  useEffect(() => {
    return () => {
      requestAbortRef.current?.abort();
      requestAbortRef.current = null;
    };
  }, []);

  useEffect(() => {
    const pendingAction = window.sessionStorage.getItem("dashboard:pending-action");
    if (pendingAction !== "projects-new-project") return;
    window.sessionStorage.removeItem("dashboard:pending-action");
    dispatchProjectsEvent(PROJECTS_EVENTS.openNewProject);
  }, []);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      if (!loadOnMount) return;
    }

    const timer = window.setTimeout(() => {
      void loadProjects();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [loadOnMount, loadProjects]);

  const refreshProjects = useCallback((detail?: ProjectsRefreshEventDetail) => {
    void loadProjects().then((refreshed) => {
      if (refreshed && detail?.source !== "realtime") {
        toast.success("Projetos atualizados.");
      }
    });
  }, [loadProjects]);

  const handleSetSearch = useCallback((query: string) => {
    setSearch(query);
    setPage(1);
  }, []);

  const handleSetStatus = useCallback((nextStatus: ProjectsStatusFilter) => {
    setStatus(nextStatus);
    setPage(1);
  }, []);

  const handleSetHealth = useCallback((nextHealth: ProjectsHealthFilter) => {
    setHealth(nextHealth);
    setPage(1);
  }, []);

  return {
    data,
    page,
    totalPages,
    search,
    status,
    health,
    isLoading,
    lastUpdatedAt,
    hasActiveFilters,
    setPage,
    setSearch: handleSetSearch,
    setStatus: handleSetStatus,
    setHealth: handleSetHealth,
    refreshProjects,
  };
}
