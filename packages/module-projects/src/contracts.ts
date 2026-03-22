import {
  PROJECT_HEALTH_STATES,
  PROJECT_STATUSES,
  type ProjectHealth,
  type ProjectStatus,
  type ProjectsDueWindow,
} from "./data";

export {
  PROJECT_HEALTH_STATES,
  PROJECT_STATUSES,
};

export const PROJECT_MEMBER_ROLES = ["owner", "contributor", "observer"] as const;
export const PROJECT_MEMBER_ROLE_LABELS_PT: Record<(typeof PROJECT_MEMBER_ROLES)[number], string> = {
  owner: "Gestor de projeto",
  contributor: "Colaborador",
  observer: "Observador",
};
export const TASK_STATUSES = ["todo", "in_progress", "blocked", "done"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const MILESTONE_STATUSES = ["pending", "in_progress", "achieved", "delayed"] as const;
export const PROJECT_LINK_VISIBILITY = ["staff", "client"] as const;
export const PROJECT_LINK_KIND = ["doc", "sheet", "drive", "other"] as const;

export type {
  ProjectHealth,
  ProjectStatus,
  ProjectsDueWindow,
};

export type ProjectMemberRole = (typeof PROJECT_MEMBER_ROLES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];
export type ProjectLinkVisibility = (typeof PROJECT_LINK_VISIBILITY)[number];
export type ProjectLinkKind = (typeof PROJECT_LINK_KIND)[number];

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return typeof value === "string" && PROJECT_STATUSES.some((status) => status === value);
}

export function isProjectHealth(value: unknown): value is ProjectHealth {
  return typeof value === "string" && PROJECT_HEALTH_STATES.some((status) => status === value);
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && TASK_STATUSES.some((status) => status === value);
}

export function isTaskPriority(value: unknown): value is TaskPriority {
  return typeof value === "string" && TASK_PRIORITIES.some((status) => status === value);
}

export function isMilestoneStatus(value: unknown): value is MilestoneStatus {
  return typeof value === "string" && MILESTONE_STATUSES.some((status) => status === value);
}

export function isProjectMemberRole(value: unknown): value is ProjectMemberRole {
  return typeof value === "string" && PROJECT_MEMBER_ROLES.some((role) => role === value);
}

export function isProjectLinkVisibility(value: unknown): value is ProjectLinkVisibility {
  return typeof value === "string" && PROJECT_LINK_VISIBILITY.some((role) => role === value);
}

export function isProjectLinkKind(value: unknown): value is ProjectLinkKind {
  return typeof value === "string" && PROJECT_LINK_KIND.some((kind) => kind === value);
}

export function parsePositiveInt(value: string | null, fallback: number, max = 100): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(Math.floor(parsed), max);
}
