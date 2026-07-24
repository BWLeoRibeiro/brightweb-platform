import { dispatchWindowCustomEvent, dispatchWindowEvent } from "./window-events";

export const PROJECTS_EVENTS = {
  openNewProject: "projects:open-new-project",
  openNewTask: "projects:open-new-task",
  openNewMilestone: "projects:open-new-milestone",
  openNewLink: "projects:open-new-link",
  openEditProject: "projects:open-edit-project",
  refresh: "projects:refresh",
  refreshComplete: "projects:refresh-complete",
  state: "projects:state",
  setSearch: "projects:set-search",
  setStatus: "projects:set-status",
  setHealth: "projects:set-health",
  boardMilestoneState: "projects:board-milestone-state",
  setBoardMilestone: "projects:set-board-milestone",
} as const;

export type ProjectsStatusFilter = "all" | "planned" | "active" | "blocked" | "completed" | "canceled";
export type ProjectsHealthFilter = "all" | "on_track" | "at_risk" | "off_track";

export type ProjectsStateEventDetail = {
  search?: string;
  status?: ProjectsStatusFilter;
  health?: ProjectsHealthFilter;
  isLoading?: boolean;
  total?: number;
};

export type ProjectsRefreshEventDetail = {
  source?: "manual" | "realtime";
};

export type ProjectsBoardMilestoneOption = {
  id: string;
  title: string;
};

export type ProjectsBoardMilestoneStateDetail = {
  options: ProjectsBoardMilestoneOption[];
  selectedMilestoneId: string;
};

export type ProjectsBoardSetMilestoneDetail = {
  milestoneId: string;
};

export function dispatchProjectsEvent(name: string) {
  dispatchWindowEvent(name);
}

export function dispatchProjectsCustomEvent<T>(name: string, detail: T) {
  dispatchWindowCustomEvent(name, detail);
}
