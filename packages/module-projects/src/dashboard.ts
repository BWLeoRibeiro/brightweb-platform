import type {
  DashboardAssignedTask,
  DashboardProjectItem,
  DashboardProjectsData,
  DashboardTaskAttentionState,
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
const DASHBOARD_TASK_PAGE_SIZE = 50;
const DASHBOARD_TASK_PAGE_SIZE_MAX = 100;
const DASHBOARD_ATTENTION_LIMIT = 6;
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
  attentionTotal: number;
  attentionTasks: DashboardAssignedTask[];
  page: number;
  pageSize: number;
};

export type TasksDashboardOptions = {
  page?: number;
  pageSize?: number;
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
    attention: {
      total: snapshot.attentionTotal,
      tasks: snapshot.attentionTasks,
    },
    pagination: {
      page: snapshot.page,
      pageSize: snapshot.pageSize,
      hasMore: snapshot.page * snapshot.pageSize < snapshot.total,
    },
  };
}

const ATTENTION_STATE_ORDER: Record<DashboardTaskAttentionState, number> = {
  blocked: 0,
  overdue: 1,
  today: 2,
  soon: 3,
};

const PRIORITY_ORDER: Record<DashboardAssignedTask["priority"], number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function getDashboardTaskAttentionState(
  task: Pick<DashboardAssignedTask, "status" | "dueDate">,
  now = new Date(),
): DashboardTaskAttentionState | null {
  if (task.status === "blocked") return "blocked";
  if (!task.dueDate) return null;
  const today = dateOnly(now);
  const next7Days = dateOnly(now, 7);
  if (task.dueDate < today) return "overdue";
  if (task.dueDate === today) return "today";
  if (task.dueDate <= next7Days) return "soon";
  return null;
}

export function rankDashboardAttentionTasks(tasks: DashboardAssignedTask[], now = new Date()) {
  return tasks
    .map((task) => ({ task, state: getDashboardTaskAttentionState(task, now) }))
    .filter((entry): entry is { task: DashboardAssignedTask; state: DashboardTaskAttentionState } => entry.state !== null)
    .sort((a, b) => {
      const stateDifference = ATTENTION_STATE_ORDER[a.state] - ATTENTION_STATE_ORDER[b.state];
      if (stateDifference !== 0) return stateDifference;
      const priorityDifference = PRIORITY_ORDER[a.task.priority] - PRIORITY_ORDER[b.task.priority];
      if (priorityDifference !== 0) return priorityDifference;
      const dueDifference = (a.task.dueDate ?? "9999-12-31").localeCompare(b.task.dueDate ?? "9999-12-31");
      if (dueDifference !== 0) return dueDifference;
      const updatedDifference = b.task.updatedAt.localeCompare(a.task.updatedAt);
      if (updatedDifference !== 0) return updatedDifference;
      return a.task.id.localeCompare(b.task.id);
    })
    .map((entry) => entry.task);
}

async function listAttentionTaskRows(
  supabase: SupabaseClient,
  profileId: string | undefined,
  columns: string,
  today: string,
  next7Days: string,
) {
  const priorities: DashboardAssignedTask["priority"][] = ["urgent", "high", "medium", "low"];
  const states: DashboardTaskAttentionState[] = ["blocked", "overdue", "today", "soon"];
  const results = await Promise.all(states.flatMap((state) => priorities.map(async (priority) => {
    let query = activeAssignedTasksQuery(supabase, profileId, columns).eq("priority", priority);
    if (state === "blocked") query = query.eq("status", "blocked");
    if (state === "overdue") query = query.neq("status", "blocked").lt("due_date", today);
    if (state === "today") query = query.neq("status", "blocked").eq("due_date", today);
    if (state === "soon") query = query.neq("status", "blocked").gte("due_date", dateOnly(new Date(`${today}T00:00:00.000Z`), 1)).lte("due_date", next7Days);
    const result = await query
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(DASHBOARD_ATTENTION_LIMIT);
    if (result.error) throw new Error(result.error.message);
    return (result.data ?? []) as unknown as DashboardTaskRow[];
  })));
  return results.flat();
}

export async function getTasksDashboardData(
  supabase: SupabaseClient,
  profileId?: string,
  now = new Date(),
  options: TasksDashboardOptions = {},
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

  const page = Math.max(1, Math.floor(options.page ?? 1));
  const pageSize = Math.min(DASHBOARD_TASK_PAGE_SIZE_MAX, Math.max(1, Math.floor(options.pageSize ?? DASHBOARD_TASK_PAGE_SIZE)));
  const from = (page - 1) * pageSize;
  const tasksQuery = activeAssignedTasksQuery(supabase, profileId, taskColumns)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, from + pageSize - 1);
  const totalQuery = activeAssignedTasksQuery(supabase, profileId, "id", { count: "exact", head: true });
  const dueThisWeekQuery = activeAssignedTasksQuery(supabase, profileId, "id", { count: "exact", head: true })
    .neq("status", "blocked")
    .gte("due_date", today)
    .lte("due_date", next7Days);
  const overdueQuery = activeAssignedTasksQuery(supabase, profileId, "id", { count: "exact", head: true })
    .neq("status", "blocked")
    .lt("due_date", today);
  const blockedQuery = activeAssignedTasksQuery(supabase, profileId, "id", { count: "exact", head: true })
    .eq("status", "blocked");
  const attentionTotalQuery = activeAssignedTasksQuery(supabase, profileId, "id", { count: "exact", head: true })
    .or(`status.eq.blocked,due_date.lte.${next7Days}`);

  const attentionRowsPromise = listAttentionTaskRows(supabase, profileId, taskColumns, today, next7Days);
  const [tasksResult, total, dueThisWeek, overdue, blocked, attentionTotal, attentionRows] = await Promise.all([
    tasksQuery,
    resolveCount(totalQuery),
    resolveCount(dueThisWeekQuery),
    resolveCount(overdueQuery),
    resolveCount(blockedQuery),
    resolveCount(attentionTotalQuery),
    attentionRowsPromise,
  ]);
  if (tasksResult.error) throw new Error(tasksResult.error.message);

  const attentionTasks = rankDashboardAttentionTasks(attentionRows.map(normalizeDashboardTask), now);
  return buildTasksDashboardData({
    generatedAt: now.toISOString(),
    total,
    dueThisWeek,
    overdue,
    blocked,
    tasks: ((tasksResult.data ?? []) as unknown as DashboardTaskRow[]).map(normalizeDashboardTask),
    attentionTotal,
    attentionTasks: attentionTasks.slice(0, DASHBOARD_ATTENTION_LIMIT),
    page,
    pageSize,
  });
}
