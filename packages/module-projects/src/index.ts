import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@brightweb/infra/server";

export const PROJECT_STATUSES = ["planned", "active", "blocked", "completed", "canceled"] as const;
export const PROJECT_HEALTH_STATES = ["on_track", "at_risk", "off_track"] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ProjectHealth = (typeof PROJECT_HEALTH_STATES)[number];
export type ProjectsDueWindow = "all" | "overdue" | "next_7_days" | "next_30_days";

export type ProjectListItem = {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationOwnerLabel: string | null;
  organizationOwnerEmail: string | null;
  organizationOwnerPhone: string | null;
  name: string;
  code: string | null;
  status: ProjectStatus;
  health: ProjectHealth;
  ownerProfileId: string | null;
  ownerLabel: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  activatedAt: string | null;
  targetDate: string | null;
  completedAt: string | null;
  cancellationReason: string | null;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
  taskStats: {
    total: number;
    done: number;
    overdue: number;
    blocked: number;
  };
  milestoneStats: {
    total: number;
    achieved: number;
    delayed: number;
  };
};

export type ListProjectsParams = {
  search?: string;
  status?: ProjectStatus | null;
  health?: ProjectHealth | null;
  organizationId?: string | null;
  ownerProfileId?: string | null;
  dueWindow?: ProjectsDueWindow;
  page?: number;
  pageSize?: number;
};

export type ProjectsPortfolioStats = {
  total: number;
  planned: number;
  active: number;
  atRisk: number;
  overdue: number;
};

export type ProjectsListResult = {
  items: ProjectListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type ProjectsPortfolioPageData = {
  organizationOptions: {
    id: string;
    name: string;
  }[];
  portfolioStats: ProjectsPortfolioStats;
  result: ProjectsListResult;
  schemaMissing: boolean;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const PROJECT_SELECT_COLUMNS = "id, organization_id, name, code, status, health, owner_profile_id, activated_at, target_date, completed_at, cancellation_reason, summary, created_at, updated_at, organizations(name, primary_contact:profiles!organizations_primary_contact_id_fkey(first_name, last_name, email, phone)), owner:profiles!projects_owner_profile_id_fkey(first_name, last_name, email, phone)";
const PROJECT_SELECT_COLUMNS_LEGACY = "id, organization_id, name, code, status, health, owner_profile_id, activated_at, target_date, completed_at, summary, created_at, updated_at, organizations(name, primary_contact:profiles!organizations_primary_contact_id_fkey(first_name, last_name, email, phone)), owner:profiles!projects_owner_profile_id_fkey(first_name, last_name, email, phone)";

export function isProjectsSchemaMissingError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("could not find the table 'public.projects' in the schema cache")
    || message.includes("relation \"projects\" does not exist")
    || message.includes("relation \"public.projects\" does not exist")
    || message.includes("relation \"project_tasks\" does not exist")
    || message.includes("relation \"public.project_tasks\" does not exist")
    || message.includes("column projects.cancellation_reason does not exist")
  );
}

function isMissingProjectCancellationReasonColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("column projects.cancellation_reason does not exist")
    || message.includes("column \"cancellation_reason\" does not exist")
  );
}

function toDateString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function mapRows<T>(rows: unknown[] | null | undefined, mapper: (row: Record<string, unknown>) => T): T[] {
  const mapped: T[] = [];
  for (const row of rows ?? []) {
    const record = toRecord(row);
    if (record) mapped.push(mapper(record));
  }
  return mapped;
}

function daysFromToday(dateLike: string | null): number | null {
  if (!dateLike) return null;
  const parsed = new Date(`${dateLike}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((parsed.getTime() - today.getTime()) / DAY_IN_MS);
}

function deriveProjectHealth(project: Pick<ProjectListItem, "status" | "targetDate" | "taskStats">): ProjectListItem["health"] {
  if (project.status === "completed") return "on_track";
  if (project.status === "canceled" || project.status === "blocked") return "off_track";

  const targetInDays = daysFromToday(project.targetDate);
  if (project.status === "active" && targetInDays !== null && targetInDays < 0) return "off_track";

  if (project.status === "active" && targetInDays !== null && targetInDays <= 7) {
    const hasBlockedTasks = project.taskStats.blocked > 0;
    const totalTasks = project.taskStats.total;
    const notDoneTasks = Math.max(totalTasks - project.taskStats.done, 0);
    const hasHalfOrMoreTasksNotDone = totalTasks > 0 && notDoneTasks / totalTasks >= 0.5;

    if (hasBlockedTasks || hasHalfOrMoreTasksNotDone) return "at_risk";
  }

  return "on_track";
}

function profileLabel(firstName: unknown, lastName: unknown, email: unknown): string | null {
  const full = [firstName, lastName]
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .join(" ")
    .trim();
  if (full) return full;
  return typeof email === "string" && email.trim().length > 0 ? email : null;
}

function normalizeProjectRow(row: Record<string, unknown>): ProjectListItem {
  const ownerRaw = row.owner;
  const owner = Array.isArray(ownerRaw) ? ownerRaw[0] ?? null : ownerRaw;
  const orgRaw = row.organizations;
  const org = Array.isArray(orgRaw) ? orgRaw[0] ?? null : orgRaw;
  const organizationPrimaryContactRaw = org?.primary_contact;
  const organizationPrimaryContact = Array.isArray(organizationPrimaryContactRaw)
    ? organizationPrimaryContactRaw[0] ?? null
    : organizationPrimaryContactRaw;

  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    organizationName: typeof org?.name === "string" ? org.name : "Organização",
    organizationOwnerLabel: profileLabel(
      organizationPrimaryContact?.first_name,
      organizationPrimaryContact?.last_name,
      organizationPrimaryContact?.email,
    ),
    organizationOwnerEmail: typeof organizationPrimaryContact?.email === "string" ? organizationPrimaryContact.email : null,
    organizationOwnerPhone: typeof organizationPrimaryContact?.phone === "string" ? organizationPrimaryContact.phone : null,
    name: typeof row.name === "string" ? row.name : "Projeto",
    code: typeof row.code === "string" ? row.code : null,
    status: String(row.status) as ProjectStatus,
    health: String(row.health) as ProjectHealth,
    ownerProfileId: typeof row.owner_profile_id === "string" ? row.owner_profile_id : null,
    ownerLabel: profileLabel(owner?.first_name, owner?.last_name, owner?.email),
    ownerEmail: typeof owner?.email === "string" ? owner.email : null,
    ownerPhone: typeof owner?.phone === "string" ? owner.phone : null,
    activatedAt: toDateString(row.activated_at),
    targetDate: toDateString(row.target_date),
    completedAt: toDateString(row.completed_at),
    cancellationReason: typeof row.cancellation_reason === "string" ? row.cancellation_reason : null,
    summary: typeof row.summary === "string" ? row.summary : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    taskStats: {
      total: 0,
      done: 0,
      overdue: 0,
      blocked: 0,
    },
    milestoneStats: {
      total: 0,
      achieved: 0,
      delayed: 0,
    },
  };
}

export async function getProjectPortfolioStats(
  supabase: SupabaseClient,
): Promise<ProjectsPortfolioStats> {
  const today = new Date().toISOString().slice(0, 10);
  const [
    { count: totalCount, error: totalError },
    { count: plannedCount, error: plannedError },
    { count: activeCount, error: activeError },
    { count: atRiskCount, error: atRiskError },
    { count: overdueCount, error: overdueCountError },
  ] = await Promise.all([
    supabase.from("projects").select("id", { count: "exact", head: true }).not("status", "in", "(completed,canceled)"),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("status", "planned"),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("projects").select("id", { count: "exact", head: true }).or("health.eq.at_risk,status.eq.blocked"),
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .lt("target_date", today)
      .not("status", "in", "(completed,canceled)"),
  ]);

  const aggregateError = totalError ?? plannedError ?? activeError ?? atRiskError ?? overdueCountError;
  if (aggregateError) throw new Error(aggregateError.message);

  return {
    total: totalCount ?? 0,
    planned: plannedCount ?? 0,
    active: activeCount ?? 0,
    atRisk: atRiskCount ?? 0,
    overdue: overdueCount ?? 0,
  };
}

export async function listProjects(
  supabase: SupabaseClient,
  params: ListProjectsParams,
): Promise<ProjectsListResult> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const runProjectsListQuery = (columns: string) => {
    let query = supabase
      .from("projects")
      .select(columns, { count: "exact" })
      .order("updated_at", { ascending: false })
      .range(from, to);

    if (!params.status) query = query.not("status", "in", "(completed,canceled)");
    if (params.status) query = query.eq("status", params.status);
    if (params.health === "at_risk") {
      query = query.or("health.eq.at_risk,status.eq.blocked");
    } else if (params.health === "off_track") {
      query = query.lt("target_date", new Date().toISOString().slice(0, 10)).not("status", "in", "(completed,canceled)");
    } else if (params.health) {
      query = query.eq("health", params.health);
    }
    if (params.organizationId) query = query.eq("organization_id", params.organizationId);
    if (params.ownerProfileId) query = query.eq("owner_profile_id", params.ownerProfileId);
    if (params.search?.trim()) {
      const safe = params.search.trim().replace(/[%_,()"]/g, "");
      const pattern = `%${safe}%`;
      query = query.or(`name.ilike.${pattern},code.ilike.${pattern}`);
    }

    if (params.dueWindow === "overdue") {
      query = query.lt("target_date", new Date().toISOString().slice(0, 10)).not("status", "in", "(completed,canceled)");
    }

    if (params.dueWindow === "next_7_days") {
      const now = new Date();
      const end = new Date();
      end.setDate(now.getDate() + 7);
      query = query.gte("target_date", now.toISOString().slice(0, 10)).lte("target_date", end.toISOString().slice(0, 10));
    }

    if (params.dueWindow === "next_30_days") {
      const now = new Date();
      const end = new Date();
      end.setDate(now.getDate() + 30);
      query = query.gte("target_date", now.toISOString().slice(0, 10)).lte("target_date", end.toISOString().slice(0, 10));
    }

    return query;
  };

  let { data, error, count } = await runProjectsListQuery(PROJECT_SELECT_COLUMNS);
  if (error && isMissingProjectCancellationReasonColumnError(error)) {
    ({ data, error, count } = await runProjectsListQuery(PROJECT_SELECT_COLUMNS_LEGACY));
  }
  if (error) throw new Error(error.message);

  const items = mapRows(data, normalizeProjectRow);
  if (items.length > 0) {
    const ids = items.map((item) => item.id);

    const [{ data: taskRows }, { data: milestoneRows }] = await Promise.all([
      supabase.from("project_tasks").select("project_id, status, due_date").in("project_id", ids),
      supabase.from("project_milestones").select("project_id, status").in("project_id", ids),
    ]);

    const today = new Date().toISOString().slice(0, 10);
    const statsByProject = new Map<string, ProjectListItem["taskStats"]>();
    for (const row of taskRows ?? []) {
      const projectId = typeof row.project_id === "string" ? row.project_id : "";
      if (!projectId) continue;
      const current = statsByProject.get(projectId) ?? { total: 0, done: 0, overdue: 0, blocked: 0 };
      current.total += 1;
      if (row.status === "done") current.done += 1;
      if (row.status === "blocked") current.blocked += 1;
      if (typeof row.due_date === "string" && row.due_date < today && row.status !== "done") current.overdue += 1;
      statsByProject.set(projectId, current);
    }

    const milestoneStatsByProject = new Map<string, ProjectListItem["milestoneStats"]>();
    for (const row of milestoneRows ?? []) {
      const projectId = typeof row.project_id === "string" ? row.project_id : "";
      if (!projectId) continue;
      const current = milestoneStatsByProject.get(projectId) ?? { total: 0, achieved: 0, delayed: 0 };
      current.total += 1;
      if (row.status === "achieved") current.achieved += 1;
      if (row.status === "delayed") current.delayed += 1;
      milestoneStatsByProject.set(projectId, current);
    }

    items.forEach((item) => {
      item.taskStats = statsByProject.get(item.id) ?? item.taskStats;
      item.milestoneStats = milestoneStatsByProject.get(item.id) ?? item.milestoneStats;
      item.health = deriveProjectHealth(item);
    });
  }

  return {
    items,
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function getProjectsPortfolioPageData(): Promise<ProjectsPortfolioPageData> {
  const supabase = await createServerSupabase();
  const { data: organizations } = await supabase
    .from("organizations")
    .select("id, name")
    .order("name", { ascending: true })
    .limit(500);

  const organizationOptions = (organizations ?? []).map((organization) => ({
    id: organization.id,
    name: organization.name,
  }));

  let result: ProjectsListResult;
  let portfolioStats: ProjectsPortfolioStats;
  let schemaMissing = false;

  try {
    [portfolioStats, result] = await Promise.all([
      getProjectPortfolioStats(supabase),
      listProjects(supabase, { page: 1, pageSize: 9, dueWindow: "all" }),
    ]);
  } catch (error) {
    if (isProjectsSchemaMissingError(error)) {
      schemaMissing = true;
      portfolioStats = { total: 0, planned: 0, active: 0, atRisk: 0, overdue: 0 };
      result = { items: [], total: 0, page: 1, pageSize: 9 };
    } else {
      throw error;
    }
  }

  return {
    organizationOptions,
    portfolioStats,
    result,
    schemaMissing,
  };
}
