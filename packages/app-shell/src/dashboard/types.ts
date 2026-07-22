import type { ComponentType } from "react";

export type DashboardProjectStatus = "planned" | "active" | "blocked" | "completed" | "canceled";
export type DashboardProjectHealth = "on_track" | "at_risk" | "off_track";
export type DashboardTaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type DashboardTaskPriority = "low" | "medium" | "high" | "urgent";

export type DashboardProjectItem = {
  id: string;
  organizationName: string;
  name: string;
  code: string | null;
  status: DashboardProjectStatus;
  health: DashboardProjectHealth;
  ownerLabel: string | null;
  targetDate: string | null;
  taskStats: { total: number; done: number; overdue: number; blocked: number };
};

export type DashboardProjectsData = {
  generatedAt: string;
  kpis: {
    projectsActive: number;
    projectsAtRisk: number;
    projectsOverdue: number;
    projectsDueNext7Days: number;
    projectsWithoutOwner: number;
    projectBlockedTasks: number;
  };
  projects: { overdue: DashboardProjectItem[] };
};

export type DashboardCrmStatusBreakdown = {
  lead: number;
  qualified: number;
  proposal: number;
  won: number;
  lost: number;
};

export type DashboardCrmRecentChange = {
  id: string;
  contactId: string;
  contactLabel: string;
  previousStatus: string | null;
  newStatus: string | null;
  changedAt: string;
};

export type DashboardCrmRecentContact = {
  id: string;
  name: string;
  company: string | null;
  status: string;
  lastChangedAt: string;
};

export type DashboardCrmData = {
  generatedAt: string;
  kpis: {
    crmTotalContacts: number;
    crmNewLast7Days: number;
    crmNewLast30Days: number;
    crmNewLastYear: number;
    crmUnassignedContacts: number;
  };
  crm: {
    statusBreakdown: DashboardCrmStatusBreakdown;
    recentChanges: DashboardCrmRecentChange[];
    recentContacts: DashboardCrmRecentContact[];
  };
};

export type DashboardAssignedTask = {
  id: string;
  projectId: string;
  projectName: string;
  projectCode: string | null;
  title: string;
  status: DashboardTaskStatus;
  priority: DashboardTaskPriority;
  dueDate: string | null;
  blockedReason: string | null;
  milestoneId: string | null;
  updatedAt: string;
};

export type DashboardTasksData = {
  generatedAt: string;
  kpis: { total: number; dueThisWeek: number; overdue: number; blocked: number };
  tasks: DashboardAssignedTask[];
};

export type DashboardInitialData = {
  projects?: DashboardProjectsData | null;
  crm?: DashboardCrmData | null;
  tasks?: DashboardTasksData | null;
};

export type DashboardDataClient = {
  getOverview: () => Promise<unknown>;
  getProjects: () => Promise<unknown>;
  getCrm: () => Promise<unknown>;
  getTasks: () => Promise<unknown>;
};

export type DashboardSection = "projects" | "crm" | "tasks";

export type DashboardProjectComponents = {
  ProjectSummaryCard: ComponentType<{ project: DashboardProjectItem }>;
  ProjectSummaryCardSkeleton: ComponentType;
  TaskDueMeta: ComponentType<{ dueDate: string | null; isOverdue?: boolean }>;
  TaskPriorityTag: ComponentType<{ task: Pick<DashboardAssignedTask, "status" | "priority"> }>;
  TaskStatusTag: ComponentType<{ task: Pick<DashboardAssignedTask, "status" | "blockedReason"> }>;
};

export type DashboardSurfaceContribution = {
  key: string;
  sections: DashboardSection[];
  projectComponents?: DashboardProjectComponents;
};

export type DashboardOverviewShellData = {
  projects: DashboardProjectsData;
  crm: DashboardCrmData;
};

export type DashboardBootstrapData = DashboardOverviewShellData & { tasks: DashboardTasksData };
