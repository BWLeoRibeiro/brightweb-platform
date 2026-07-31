import type {
  DashboardAssignedTask,
  DashboardProjectItem,
  DashboardProjectsData,
  DashboardTasksData,
} from "@brightweblabs/app-shell";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getProjectPortfolioStats,
  listProjects,
  type ProjectListItem,
  type ProjectsPortfolioStats,
} from "./data";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DASHBOARD_TASK_LIMIT = 100;
const DASHBOARD_OVERDUE_PROJECT_LIMIT = 12;

type CountQueryResult = {
  count: number | null;
  error: { message: string } | null;
};

type DashboardTaskRow = {
  id: string;
  project_id: string;
  milestone_id: string | null;
  title: string;
  status: DashboardAssignedTask["status"];
  priority: DashboardAssignedTask["priority"];
  due_date: string | null;
  blocked_reason: string | null;
  updated_at: string;
  projects:
    | { name?: string | null; code?: string | null }
    | Array<{ name?: string | null; code?: string | null }>
    | null;
};

export type ProjectsDashboardSnapshot = {
  generatedAt: string;
  portfolioStats: ProjectsPortfolioStats;
  overdueProjects: ProjectListItem[];
  dueNext7Days: number;
  withoutOwner: number;
  blockedTasks: number;
};

export type TasksDashboardSnapshot = {
  generatedAt: string;
  total: number;
  dueThisWeek: number;
  overdue: number;
  blocked: number;
  tasks: DashboardAssignedTask[];
};

function dateOnly(now: Date, daysFromNow = 0) {
  return new Date(now.getTime() + daysFromNow * DAY_IN_MS).toISOString().slice(0, 10);
}

async function resolveCount(query: PromiseLike<CountQueryResult>) {
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

function toDashboardProject(project: ProjectListItem): DashboardProjectItem {
  return {
    id: project.id,
    organizationName: project.organizationName,
    name: project.name,
    code: project.code,
    status: project.status,
    health: project.health,
    ownerLabel: project.ownerLabel,
    targetDate: project.targetDate,
    taskStats: { ...project.taskStats },
  };
}

export function buildProjectsDashboardData(snapshot: ProjectsDashboardSnapshot): DashboardProjectsData {
  return {
    generatedAt: snapshot.generatedAt,
    kpis: {
      projectsActive: snapshot.portfolioStats.active,
      projectsAtRisk: snapshot.portfolioStats.atRisk,
      projectsOverdue: snapshot.portfolioStats.overdue,
      projectsDueNext7Days: snapshot.dueNext7Days,
      projectsWithoutOwner: snapshot.withoutOwner,
      projectBlockedTasks: snapshot.blockedTasks,
    },
    projects: {
      overdue: snapshot.overdueProjects.map(toDashboardProject),
    },
  };
}

export async function getProjectsDashboardData(
  supabase: SupabaseClient,
  now = new Date(),
): Promise<DashboardProjectsData> {
  const today = dateOnly(now);
  const next7Days = dateOnly(now, 7);

  const [portfolioStats, overdueResult, dueNext7Days, withoutOwner, blockedTasks] = await Promise.all([
    getProjectPortfolioStats(supabase),
    listProjects(supabase, {
      page: 1,
      pageSize: DASHBOARD_OVERDUE_PROJECT_LIMIT,
      dueWindow: "overdue",
    }),
    resolveCount(
      supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .gte("target_date", today)
        .lte("target_date", next7Days)
        .not("status", "in", "(completed,canceled)"),
    ),
    resolveCount(
      supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .is("owner_profile_id", null)
        .not("status", "in", "(completed,canceled)"),
    ),
    resolveCount(
      supabase
        .from("project_tasks")
        .select("id", { count: "exact", head: true })
        .eq("status", "blocked"),
    ),
  ]);

  return buildProjectsDashboardData({
    generatedAt: now.toISOString(),
    portfolioStats,
    overdueProjects: overdueResult.items,
    dueNext7Days,
    withoutOwner,
    blockedTasks,
  });
}

function activeAssignedTasksQuery(
  supabase: SupabaseClient,
  profileId: string | undefined,
  columns: string,
  options?: { count: "exact" | "planned"; head: true },
) {
  let query = supabase
    .from("project_tasks")
    .select(columns, options)
    .neq("status", "done");
  if (profileId) query = query.eq("assignee_profile_id", profileId);
  return query;
}

function normalizeDashboardTask(row: DashboardTaskRow): DashboardAssignedTask {
  const projectRaw = Array.isArray(row.projects) ? row.projects[0] ?? null : row.projects;
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: projectRaw?.name || "Projeto",
    projectCode: projectRaw?.code || null,
    title: row.title,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    blockedReason: row.blocked_reason,
    milestoneId: row.milestone_id,
    updatedAt: row.updated_at,
  };
}

export function buildTasksDashboardData(snapshot: TasksDashboardSnapshot): DashboardTasksData {
  return {
    generatedAt: snapshot.generatedAt,
    kpis: {
      total: snapshot.total,
      dueThisWeek: snapshot.dueThisWeek,
      overdue: snapshot.overdue,
      blocked: snapshot.blocked,
    },
    tasks: snapshot.tasks,
  };
}

export async function getTasksDashboardData(
  supabase: SupabaseClient,
  profileId?: string,
  now = new Date(),
): Promise<DashboardTasksData> {
  const today = dateOnly(now);
  const next7Days = dateOnly(now, 7);
  const taskColumns = [
    "id",
    "project_id",
    "milestone_id",
    "title",
    "status",
    "priority",
    "due_date",
    "blocked_reason",
    "updated_at",
    "projects(name, code)",
  ].join(", ");

  const tasksQuery = activeAssignedTasksQuery(supabase, profileId, taskColumns)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(DASHBOARD_TASK_LIMIT);
  const totalQuery = activeAssignedTasksQuery(supabase, profileId, "id", { count: "planned", head: true });
  const dueThisWeekQuery = activeAssignedTasksQuery(supabase, profileId, "id", { count: "exact", head: true })
    .gte("due_date", today)
    .lte("due_date", next7Days);
  const overdueQuery = activeAssignedTasksQuery(supabase, profileId, "id", { count: "exact", head: true })
    .lt("due_date", today);
  const blockedQuery = activeAssignedTasksQuery(supabase, profileId, "id", { count: "exact", head: true })
    .eq("status", "blocked");

  const [tasksResult, total, dueThisWeek, overdue, blocked] = await Promise.all([
    tasksQuery,
    resolveCount(totalQuery),
    resolveCount(dueThisWeekQuery),
    resolveCount(overdueQuery),
    resolveCount(blockedQuery),
  ]);
  if (tasksResult.error) throw new Error(tasksResult.error.message);

  return buildTasksDashboardData({
    generatedAt: now.toISOString(),
    total,
    dueThisWeek,
    overdue,
    blocked,
    tasks: ((tasksResult.data ?? []) as unknown as DashboardTaskRow[]).map(normalizeDashboardTask),
  });
}
