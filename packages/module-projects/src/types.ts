import type {
  MilestoneStatus,
  ProjectHealth,
  ProjectLinkKind,
  ProjectLinkVisibility,
  ProjectMemberRole,
  ProjectStatus,
  TaskPriority,
  TaskStatus,
} from "./contracts";
import type { ListProjectsParams, ProjectListItem } from "./data";

export type {
  ListProjectsParams,
  ProjectListItem,
};

export type ProjectMember = {
  id: string;
  projectId: string;
  profileId: string;
  role: ProjectMemberRole;
  createdAt: string;
  label: string;
  email: string | null;
  phone: string | null;
};

export type ProjectMemberInput = {
  profileId: string;
  role: ProjectMemberRole;
};

export type ProjectAssignableProfile = {
  profileId: string;
  label: string;
  email: string | null;
  organizationRole: "staff" | "admin" | "org_admin" | "org_member";
  projectRole: ProjectMemberRole | null;
};

export type ProjectMilestone = {
  id: string;
  projectId: string;
  title: string;
  status: MilestoneStatus;
  health: ProjectHealth;
  targetDate: string | null;
  completedAt: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type ProjectTask = {
  id: string;
  projectId: string;
  milestoneId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  health: ProjectHealth;
  priority: TaskPriority;
  assigneeProfileId: string | null;
  assigneeLabel: string | null;
  reporterProfileId: string | null;
  reporterLabel: string | null;
  dueDate: string | null;
  position: number;
  blockedReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectLink = {
  id: string;
  projectId: string;
  label: string;
  url: string;
  visibility: ProjectLinkVisibility;
  kind: ProjectLinkKind;
  createdAt: string;
  updatedAt: string;
};

export type ProjectActivityItem = {
  id: string;
  createdAt: string;
  eventType: string;
  actorProfileId: string | null;
  actorLabel: string | null;
  summary: string;
  payload: Record<string, unknown>;
};

export type ProjectDashboardData = {
  project: ProjectListItem;
  members: ProjectMember[];
  milestones: ProjectMilestone[];
  tasks: ProjectTask[];
  links: ProjectLink[];
  activity: ProjectActivityItem[];
};

export type CreateProjectInput = {
  organizationId: string;
  name: string;
  code?: string | null;
  status?: ProjectStatus;
  ownerProfileId?: string | null;
  targetDate?: string | null;
  cancellationReason?: string | null;
  summary?: string | null;
};

export type CreateProjectOrganizationInput = {
  name: string;
  primaryContactId?: string | null;
  industry?: string | null;
  companySize?: string | null;
  budgetRange?: string | null;
  websiteUrl?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  zipCode?: string | null;
  country?: string | null;
  taxIdentifierValue?: string | null;
};

export type UpdateProjectInput = {
  name?: string;
  code?: string | null;
  status?: ProjectStatus;
  ownerProfileId?: string | null;
  targetDate?: string | null;
  cancellationReason?: string | null;
  summary?: string | null;
};

export type CreateProjectTaskInput = {
  title: string;
  description?: string | null;
  milestoneId?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeProfileId?: string | null;
  reporterProfileId?: string | null;
  dueDate?: string | null;
  blockedReason?: string | null;
};

export type UpdateProjectTaskInput = {
  title?: string;
  description?: string | null;
  milestoneId?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeProfileId?: string | null;
  reporterProfileId?: string | null;
  dueDate?: string | null;
  position?: number;
  blockedReason?: string | null;
};

export type CreateProjectMilestoneInput = {
  title: string;
  status?: MilestoneStatus;
  targetDate?: string | null;
};

export type UpdateProjectMilestoneInput = {
  title?: string;
  status?: MilestoneStatus;
  targetDate?: string | null;
  completedAt?: string | null;
  position?: number;
};

export type CreateProjectLinkInput = {
  label: string;
  url: string;
  visibility?: ProjectLinkVisibility;
  kind?: ProjectLinkKind;
};

export type UpdateProjectLinkInput = {
  label?: string;
  url?: string;
  visibility?: ProjectLinkVisibility;
  kind?: ProjectLinkKind;
};
