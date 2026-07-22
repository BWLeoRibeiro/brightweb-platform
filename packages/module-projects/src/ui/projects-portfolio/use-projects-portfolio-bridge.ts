"use client";

import { useProjectsWindowEvents } from "../hooks/use-projects-window-events";
import type { ProjectsPortfolioControllerState } from "./types";

export function useProjectsPortfolioBridge(controller: Pick<
  ProjectsPortfolioControllerState,
  "search" | "status" | "health" | "isLoading" | "data" | "refreshProjects" | "setSearch" | "setStatus" | "setHealth"
>) {
  useProjectsWindowEvents({
    search: controller.search,
    status: controller.status,
    health: controller.health,
    isLoading: controller.isLoading,
    total: controller.data.total,
    onRefresh: controller.refreshProjects,
    onSetSearch: controller.setSearch,
    onSetStatus: controller.setStatus,
    onSetHealth: controller.setHealth,
  });
}
