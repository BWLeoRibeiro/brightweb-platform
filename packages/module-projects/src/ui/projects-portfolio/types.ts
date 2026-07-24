import type { ListProjectsPayload } from "../projects-list-response-parser";
import type { ProjectsHealthFilter, ProjectsStatusFilter } from "../events";

export type OrganizationOption = {
  id: string;
  name: string;
};

export type ProjectsPortfolioStatsData = {
  total: number;
  planned: number;
  active: number;
  atRisk: number;
  overdue: number;
};

export type ProjectsPortfolioRootProps = {
  initialData: ListProjectsPayload;
  initialUpdatedAt?: string | null;
  portfolioStats: ProjectsPortfolioStatsData;
  organizations: OrganizationOption[];
  loadOnMount?: boolean;
};

export type ProjectsPortfolioControllerState = {
  data: ListProjectsPayload;
  page: number;
  totalPages: number;
  search: string;
  status: ProjectsStatusFilter;
  health: ProjectsHealthFilter;
  isLoading: boolean;
  lastUpdatedAt: string | null;
  hasActiveFilters: boolean;
  setPage: (page: number | ((current: number) => number)) => void;
  setSearch: (search: string) => void;
  setStatus: (status: ProjectsStatusFilter) => void;
  setHealth: (health: ProjectsHealthFilter) => void;
  refreshProjects: () => void;
};
