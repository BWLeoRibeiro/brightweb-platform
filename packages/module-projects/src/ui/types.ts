import type { ReactNode } from "react";
import type { ListProjectsParams, ProjectsPortfolioStats } from "../data";
import type {
  CreateProjectInput, CreateProjectLinkInput, CreateProjectMilestoneInput,
  CreateProjectOrganizationInput, CreateProjectTaskInput, ProjectActivityItem,
  ProjectAssignableProfile, ProjectDashboardData, ProjectLink, ProjectMemberInput,
  UpdateProjectInput, UpdateProjectLinkInput, UpdateProjectMilestoneInput, UpdateProjectTaskInput,
} from "../types";
import type { ListProjectsPayload } from "./projects-list-response-parser";

export type ProjectsNavigationConfig = {
  listHref: string;
  detailHref: (projectId: string) => string;
  boardHref: (projectId: string) => string;
  organizationHref?: (organizationId: string) => string;
};

export type ProjectDetailPermissions = {
  canOpenEditProject: boolean;
  canEditProjectItems: boolean;
  canCreateProjectLinks: boolean;
  canManageProjectLinks: boolean;
  canManageMembers: boolean;
  canViewOrganization: boolean;
};

export type ProjectsUiClient = {
  requestRaw: (path: string, init?: RequestInit) => Promise<Response>;
  listProjects: (params?: ListProjectsParams) => Promise<ListProjectsPayload>;
  getPortfolioStats: () => Promise<ProjectsPortfolioStats>;
  getProjectDashboard: (projectId: string) => Promise<ProjectDashboardData>;
  listProjectActivity: (projectId: string) => Promise<ProjectActivityItem[]>;
  listOrganizations: () => Promise<Array<{ id: string; name: string }>>;
  listAssignableProfiles: (projectId: string) => Promise<ProjectAssignableProfile[]>;
  createOrganization: (input: CreateProjectOrganizationInput) => Promise<{ id: string; name: string }>;
  createProject: (input: CreateProjectInput) => Promise<{ id: string; name?: string; ownerProfileId?: string | null }>;
  updateProject: (projectId: string, input: UpdateProjectInput) => Promise<ProjectDashboardData>;
  deleteProject: (projectId: string) => Promise<void>;
  syncProjectMembers: (projectId: string, members: ProjectMemberInput[]) => Promise<ProjectDashboardData>;
  createMilestone: (projectId: string, input: CreateProjectMilestoneInput) => Promise<ProjectDashboardData>;
  updateMilestone: (projectId: string, milestoneId: string, input: UpdateProjectMilestoneInput) => Promise<ProjectDashboardData>;
  deleteMilestone: (projectId: string, milestoneId: string) => Promise<ProjectDashboardData>;
  createTask: (projectId: string, input: CreateProjectTaskInput) => Promise<ProjectDashboardData>;
  updateTask: (projectId: string, taskId: string, input: UpdateProjectTaskInput) => Promise<ProjectDashboardData>;
  deleteTask: (projectId: string, taskId: string) => Promise<ProjectDashboardData>;
  createLink: (projectId: string, input: CreateProjectLinkInput) => Promise<ProjectDashboardData>;
  updateLink: (projectId: string, linkId: string, input: UpdateProjectLinkInput) => Promise<ProjectLink[]>;
  deleteLink: (projectId: string, linkId: string) => Promise<ProjectLink[]>;
};

type WidenDictionary<T> = T extends string ? string : T extends (...args: infer A) => infer R ? (...args: A) => R : T extends object ? { [K in keyof T]: WidenDictionary<T[K]> } : T;
export type ProjectsUiDictionary = WidenDictionary<typeof import("./dictionary").defaultProjectsUiDictionary>;

export type ProjectsPageSlots = { beforePortfolio?: ReactNode; afterPortfolio?: ReactNode };
export type ProjectDetailSlots = { afterHero?: ReactNode; beforeMetadata?: ReactNode };
