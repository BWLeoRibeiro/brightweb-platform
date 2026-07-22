"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import {
  isMilestoneStatus,
  isProjectHealth,
  isProjectLinkKind,
  isProjectLinkVisibility,
  isProjectMemberRole,
  isProjectStatus,
  isTaskPriority,
  isTaskStatus,
} from "../contracts";
import type {
  ProjectActivityItem,
  ProjectDashboardData,
  ProjectLink,
  ProjectListItem,
  ProjectMember,
  ProjectMilestone,
  ProjectTask,
} from "../types";

type ProjectDetailDataAction =
  | { type: "replace-dashboard"; data: ProjectDashboardData }
  | { type: "replace-links"; links: ProjectLink[] };

type ProjectDetailDataContextValue = {
  data: ProjectDashboardData;
  projectId: string;
  replaceDashboard: (data: ProjectDashboardData) => void;
  replaceLinks: (links: ProjectLink[]) => void;
  applyDashboardPayload: (payload: unknown) => boolean;
  applyLinksPayload: (payload: unknown) => boolean;
};

const ProjectDetailDataContext = createContext<ProjectDetailDataContextValue | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasTaskStats(value: unknown): value is ProjectListItem["taskStats"] {
  return (
    isRecord(value)
    && isNumber(value.total)
    && isNumber(value.done)
    && isNumber(value.overdue)
    && isNumber(value.blocked)
  );
}

function hasMilestoneStats(value: unknown): value is ProjectListItem["milestoneStats"] {
  return (
    isRecord(value)
    && isNumber(value.total)
    && isNumber(value.achieved)
    && isNumber(value.delayed)
  );
}

function isProjectItem(value: unknown): value is ProjectListItem {
  return (
    isRecord(value)
    && typeof value.id === "string"
    && typeof value.organizationId === "string"
    && typeof value.organizationName === "string"
    && isNullableString(value.organizationOwnerLabel)
    && isNullableString(value.organizationOwnerEmail)
    && isNullableString(value.organizationOwnerPhone)
    && typeof value.name === "string"
    && isNullableString(value.code)
    && isProjectStatus(value.status)
    && isProjectHealth(value.health)
    && isNullableString(value.ownerProfileId)
    && isNullableString(value.ownerLabel)
    && isNullableString(value.ownerEmail)
    && isNullableString(value.ownerPhone)
    && isNullableString(value.activatedAt)
    && isNullableString(value.targetDate)
    && isNullableString(value.completedAt)
    && isNullableString(value.cancellationReason)
    && isNullableString(value.summary)
    && typeof value.createdAt === "string"
    && typeof value.updatedAt === "string"
    && hasTaskStats(value.taskStats)
    && hasMilestoneStats(value.milestoneStats)
  );
}

function isProjectMember(value: unknown): value is ProjectMember {
  return (
    isRecord(value)
    && typeof value.id === "string"
    && typeof value.projectId === "string"
    && typeof value.profileId === "string"
    && isProjectMemberRole(value.role)
    && typeof value.createdAt === "string"
    && typeof value.label === "string"
    && isNullableString(value.email)
    && isNullableString(value.phone)
  );
}

function isProjectMilestone(value: unknown): value is ProjectMilestone {
  return (
    isRecord(value)
    && typeof value.id === "string"
    && typeof value.projectId === "string"
    && typeof value.title === "string"
    && isMilestoneStatus(value.status)
    && isProjectHealth(value.health)
    && isNullableString(value.targetDate)
    && isNullableString(value.completedAt)
    && isNumber(value.position)
    && typeof value.createdAt === "string"
    && typeof value.updatedAt === "string"
  );
}

function isProjectTask(value: unknown): value is ProjectTask {
  return (
    isRecord(value)
    && typeof value.id === "string"
    && typeof value.projectId === "string"
    && isNullableString(value.milestoneId)
    && typeof value.title === "string"
    && isNullableString(value.description)
    && isTaskStatus(value.status)
    && isProjectHealth(value.health)
    && isTaskPriority(value.priority)
    && isNullableString(value.assigneeProfileId)
    && isNullableString(value.assigneeLabel)
    && isNullableString(value.reporterProfileId)
    && isNullableString(value.reporterLabel)
    && isNullableString(value.dueDate)
    && isNumber(value.position)
    && isNullableString(value.blockedReason)
    && typeof value.createdAt === "string"
    && typeof value.updatedAt === "string"
  );
}

function isProjectLink(value: unknown): value is ProjectLink {
  return (
    isRecord(value)
    && typeof value.id === "string"
    && typeof value.projectId === "string"
    && typeof value.label === "string"
    && typeof value.url === "string"
    && isProjectLinkVisibility(value.visibility)
    && isProjectLinkKind(value.kind)
    && typeof value.createdAt === "string"
    && typeof value.updatedAt === "string"
  );
}

function isProjectActivityItem(value: unknown): value is ProjectActivityItem {
  return (
    isRecord(value)
    && typeof value.id === "string"
    && typeof value.createdAt === "string"
    && typeof value.eventType === "string"
    && isNullableString(value.actorProfileId)
    && isNullableString(value.actorLabel)
    && typeof value.summary === "string"
    && isRecord(value.payload)
  );
}

function parseProjectDashboardData(value: unknown): ProjectDashboardData | null {
  if (
    !isRecord(value)
    || !isProjectItem(value.project)
    || !Array.isArray(value.members)
    || !Array.isArray(value.milestones)
    || !Array.isArray(value.tasks)
    || !Array.isArray(value.links)
    || !Array.isArray(value.activity)
  ) {
    return null;
  }

  if (
    !value.members.every(isProjectMember)
    || !value.milestones.every(isProjectMilestone)
    || !value.tasks.every(isProjectTask)
    || !value.links.every(isProjectLink)
    || !value.activity.every(isProjectActivityItem)
  ) {
    return null;
  }

  return {
    project: value.project,
    members: value.members,
    milestones: value.milestones,
    tasks: value.tasks,
    links: value.links,
    activity: value.activity,
  };
}

export function parseProjectDashboardPayload(payload: unknown): ProjectDashboardData | null {
  if (!isRecord(payload) || !("data" in payload)) return null;
  return parseProjectDashboardData(payload.data);
}

export function parseProjectLinksPayload(payload: unknown): ProjectLink[] | null {
  if (!isRecord(payload) || !Array.isArray(payload.data)) return null;
  return payload.data.every(isProjectLink) ? payload.data : null;
}

export function projectDetailDataReducer(
  state: ProjectDashboardData,
  action: ProjectDetailDataAction,
): ProjectDashboardData {
  switch (action.type) {
    case "replace-dashboard":
      return action.data;
    case "replace-links":
      return { ...state, links: action.links };
    default:
      return state;
  }
}

export function ProjectDetailDataProvider({
  children,
  initialData,
}: {
  children: ReactNode;
  initialData: ProjectDashboardData;
}) {
  const [data, dispatch] = useReducer(projectDetailDataReducer, initialData);

  useEffect(() => {
    dispatch({ type: "replace-dashboard", data: initialData });
  }, [initialData]);

  const projectId = data.project.id;

  const replaceDashboard = useCallback((nextData: ProjectDashboardData) => {
    dispatch({ type: "replace-dashboard", data: nextData });
  }, []);

  const replaceLinks = useCallback((links: ProjectLink[]) => {
    dispatch({ type: "replace-links", links });
  }, []);

  const applyDashboardPayload = useCallback((payload: unknown) => {
    const nextData = parseProjectDashboardPayload(payload);
    if (!nextData || nextData.project.id !== projectId) return false;
    dispatch({ type: "replace-dashboard", data: nextData });
    return true;
  }, [projectId]);

  const applyLinksPayload = useCallback((payload: unknown) => {
    const nextLinks = parseProjectLinksPayload(payload);
    if (!nextLinks) return false;
    if (nextLinks.some((link) => link.projectId !== projectId)) return false;
    dispatch({ type: "replace-links", links: nextLinks });
    return true;
  }, [projectId]);

  const value = useMemo<ProjectDetailDataContextValue>(() => ({
    data,
    projectId,
    replaceDashboard,
    replaceLinks,
    applyDashboardPayload,
    applyLinksPayload,
  }), [applyDashboardPayload, applyLinksPayload, data, projectId, replaceDashboard, replaceLinks]);

  return (
    <ProjectDetailDataContext.Provider value={value}>
      {children}
    </ProjectDetailDataContext.Provider>
  );
}

export function useProjectDetailData() {
  const context = useContext(ProjectDetailDataContext);
  if (!context) {
    throw new Error("useProjectDetailData must be used inside ProjectDetailDataProvider.");
  }
  return context.data;
}

export function useOptionalProjectDetailData() {
  return useContext(ProjectDetailDataContext)?.data ?? null;
}

export function useProjectDetailActions() {
  const context = useContext(ProjectDetailDataContext);
  if (!context) {
    throw new Error("useProjectDetailActions must be used inside ProjectDetailDataProvider.");
  }
  return {
    applyDashboardPayload: context.applyDashboardPayload,
    applyLinksPayload: context.applyLinksPayload,
    replaceDashboard: context.replaceDashboard,
    replaceLinks: context.replaceLinks,
  };
}

export function useOptionalProjectDetailActions() {
  const context = useContext(ProjectDetailDataContext);
  if (!context) return null;
  return {
    applyDashboardPayload: context.applyDashboardPayload,
    applyLinksPayload: context.applyLinksPayload,
    replaceDashboard: context.replaceDashboard,
    replaceLinks: context.replaceLinks,
  };
}

export function useProjectDetailProject() {
  return useProjectDetailData().project;
}

export function useProjectDetailLinks() {
  return useProjectDetailData().links;
}
