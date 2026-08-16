import type { ComponentType } from "react";

export type DashboardProjectStatus = "planned" | "active" | "paused" | "blocked" | "completed" | "canceled";
export type DashboardProjectHealth = "on_track" | "at_risk" | "off_track";
export type DashboardProjectAttentionReason = "overdue" | "at_risk" | "blocked_tasks" | "without_owner" | "due_soon";
export type DashboardProjectMilestoneStatus = "pending" | "in_progress" | "delayed";
export type DashboardTaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type DashboardTaskPriority = "low" | "medium" | "high" | "urgent";
export type DashboardTaskAttentionState = "blocked" | "overdue" | "today" | "soon";

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

export type DashboardProjectAttentionItem = DashboardProjectItem & {
  attentionReason: DashboardProjectAttentionReason;
};

export type DashboardProjectMilestone = {
  id: string;
  projectId: string;
  projectName: string;
  projectCode: string | null;
  title: string;
  status: DashboardProjectMilestoneStatus;
  targetDate: string;
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
    projectsAttention: number;
    projectsOnTrack: number;
  };
  projects: {
    overdue: DashboardProjectItem[];
    attention: DashboardProjectAttentionItem[];
    milestones: DashboardProjectMilestone[];
    milestonesNext7Days?: DashboardProjectMilestone[];
  };
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
  createdAt?: string | null;
};

export type DashboardCrmMonthlyPoint = {
  /** ISO year-month, e.g. "2026-08" */
  month: string;
  count: number;
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
    monthlyNewContacts?: DashboardCrmMonthlyPoint[];
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
  attention: {
    total: number;
    tasks: DashboardAssignedTask[];
  };
  pagination: {
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
};

export type DashboardInitialData = {
  projects?: DashboardProjectsData | null;
  crm?: DashboardCrmData | null;
  tasks?: DashboardTasksData | null;
};

export type DashboardDataClient = {
  /**
   * Optional aggregate optimization. Section clients remain the source of truth.
   */
  getOverview?: (options?: { signal?: AbortSignal }) => Promise<unknown>;
  getProjects: (options?: { signal?: AbortSignal }) => Promise<unknown>;
  getCrm: (options?: { signal?: AbortSignal }) => Promise<unknown>;
  getTasks: (options?: { signal?: AbortSignal; page?: number; pageSize?: number }) => Promise<unknown>;
};

export type DashboardSection = "projects" | "crm" | "tasks";

export type DashboardProjectComponents = {
  projectBaseHref?: string;
  /** Standalone task destination. Falls back to the project destination when omitted. */
  tasksBaseHref?: string;
  ProjectSummaryCard: ComponentType<{ project: DashboardProjectItem }>;
  ProjectSummaryCardSkeleton: ComponentType;
  ProjectAttentionCard?: ComponentType<{
    project: DashboardProjectAttentionItem;
    rank: number;
    /** Resolved consumer route for this project. */
    href?: string;
  }>;
  TaskDueMeta: ComponentType<{ dueDate: string | null; isOverdue?: boolean }>;
  TaskPriorityTag: ComponentType<{ task: Pick<DashboardAssignedTask, "status" | "priority"> }>;
  TaskStatusTag: ComponentType<{ task: Pick<DashboardAssignedTask, "status" | "blockedReason"> }>;
  DashboardTaskRow: ComponentType<{
    task: DashboardAssignedTask;
    href: string;
    attentionState?: DashboardTaskAttentionState;
    attentionLabel?: string;
  }>;
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
