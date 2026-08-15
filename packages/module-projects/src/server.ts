import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@brightweblabs/infra/server";
import { fetchAllRows, getProjectTaskStats } from "./data";
import {
  getClientProject,
  listProjectSetupOptions as listProjectSetupOptionsFromDirectory,
} from "./client-access";
import type { ProjectSetupOptions } from "./client-contracts";
import {
  type CreateProjectInput,
  type CreateProjectOrganizationInput,
  type CreateProjectLinkInput,
  type CreateProjectMilestoneInput,
  type CreateProjectTaskInput,
  type ListProjectsParams,
  type ProjectAssignableProfile,
  type ProjectClientAccessSummary,
  type ProjectDashboardData,
  type ProjectLink,
  type ProjectListItem,
  type ProjectActivityItem,
  type ProjectActivityPage,
  type ProjectMilestone,
  type ProjectMember,
  type ProjectMemberColor,
  type ProjectMemberInput,
  type ProjectTask,
  type UpdateProjectInput,
  type UpdateProjectLinkInput,
  type UpdateProjectMilestoneInput,
  type UpdateProjectTaskInput,
} from "./types";

const ORGANIZATION_ADDRESS_SEPARATOR = " | ";
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const PROJECT_SELECT_COLUMNS = "id, organization_id, name, code, status, health, owner_profile_id, activated_at, start_date, target_date, completed_at, cancellation_reason, summary, created_at, updated_at, organizations!projects_organization_id_fkey(name, primary_contact:profiles!organizations_primary_contact_id_fkey(first_name, last_name, email)), owner:profiles!projects_owner_profile_id_fkey(first_name, last_name, email)";
const PROJECT_SELECT_COLUMNS_LEGACY = "id, organization_id, name, code, status, health, owner_profile_id, activated_at, start_date, target_date, completed_at, summary, created_at, updated_at, organizations!projects_organization_id_fkey(name, primary_contact:profiles!organizations_primary_contact_id_fkey(first_name, last_name, email)), owner:profiles!projects_owner_profile_id_fkey(first_name, last_name, email)";

function createProjectsServiceRoleClient() {
  return createServiceRoleClient();
}

function getProjectErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.toLowerCase();
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message.toLowerCase();
  }
  return String(error).toLowerCase();
}

async function logProjectActivityEvent(input: {
  eventType: string;
  entityId: string;
  projectId: string;
  summary: string;
  actorProfileId: string | null;
  payload?: Record<string, unknown>;
}) {
  const serviceClient = createProjectsServiceRoleClient();
  if (!serviceClient) return;

  const { error } = await serviceClient.rpc("log_project_activity_event", {
    p_event_type: input.eventType,
    p_entity_table: "projects",
    p_entity_id: input.entityId,
    p_project_id: input.projectId,
    p_summary: input.summary,
    p_payload: input.payload ?? {},
    p_actor_profile_id: input.actorProfileId,
  });

  if (error) {
    console.error("Error logging project activity event:", error);
  }
}

async function listOrganizationIdsForProfile(
  supabase: SupabaseClient,
  profileId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("profile_id", profileId);

  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((row) => (typeof row.organization_id === "string" ? row.organization_id : ""))
    .filter(Boolean);
}

export function isProjectsSchemaMissingError(error: unknown): boolean {
  const message = getProjectErrorMessage(error);
  return (
    message.includes("could not find the table 'public.projects' in the schema cache")
    || message.includes("relation \"projects\" does not exist")
    || message.includes("relation \"public.projects\" does not exist")
    || message.includes("relation \"project_tasks\" does not exist")
    || message.includes("relation \"public.project_tasks\" does not exist")
    || message.includes("could not find the table 'public.project_task_stats' in the schema cache")
    || message.includes("relation \"project_task_stats\" does not exist")
    || message.includes("relation \"public.project_task_stats\" does not exist")
    || message.includes("column projects.cancellation_reason does not exist")
  );
}

function isMissingProjectCancellationReasonColumnError(error: unknown): boolean {
  const message = getProjectErrorMessage(error);
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

function deriveTaskHealth(task: Pick<ProjectTask, "status" | "dueDate">): ProjectListItem["health"] {
  if (task.status === "done") return "on_track";

  const dueInDays = daysFromToday(task.dueDate);
  if (task.status === "blocked") {
    if (dueInDays !== null && dueInDays < 0) return "off_track";
    return "at_risk";
  }

  if (dueInDays === null) return "on_track";
  if (dueInDays < 0) return "off_track";
  if (dueInDays <= 2) return "at_risk";
  return "on_track";
}

function deriveMilestoneHealth(milestone: Pick<ProjectMilestone, "status" | "targetDate">): ProjectListItem["health"] {
  if (milestone.status === "achieved") return "on_track";
  if (milestone.status === "delayed") return "off_track";

  const targetInDays = daysFromToday(milestone.targetDate);
  if (targetInDays === null) return "on_track";
  if (targetInDays < 0) return "off_track";
  if (targetInDays <= 7) return "at_risk";
  return "on_track";
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

function toCodeToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function buildProjectCodeBase(organizationName: string, projectName: string): string {
  const orgToken = toCodeToken(organizationName).split("-").slice(0, 2).join("-") || "ORG";
  const projectToken = toCodeToken(projectName).split("-").slice(0, 3).join("-") || "PROJECT";
  const year = String(new Date().getFullYear());
  return `${orgToken}-${projectToken}-${year}`.slice(0, 72);
}

async function resolveUniqueGeneratedProjectCode(supabase: SupabaseClient, baseCode: string): Promise<string> {
  const normalizedBase = baseCode.trim().toUpperCase();
  if (!normalizedBase) return `PROJECT-${new Date().getFullYear()}`;

  const candidates = [normalizedBase, ...Array.from({ length: 40 }, (_, index) => `${normalizedBase}-${index + 2}`)];
  for (const candidate of candidates) {
    const { data, error } = await supabase
      .from("projects")
      .select("id")
      .eq("code", candidate)
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (error) throw new Error(error.message);
    if (!data?.id) {
      return candidate;
    }
  }

  return `${normalizedBase}-${Date.now().toString().slice(-4)}`;
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
    participatingOrganizations: [{
      id: String(row.organization_id),
      name: typeof org?.name === "string" ? org.name : "Organização",
      isPrimary: true,
    }],
    name: typeof row.name === "string" ? row.name : "Projeto",
    code: typeof row.code === "string" ? row.code : null,
    status: String(row.status) as ProjectListItem["status"],
    health: String(row.health) as ProjectListItem["health"],
    ownerProfileId: typeof row.owner_profile_id === "string" ? row.owner_profile_id : null,
    ownerLabel: profileLabel(owner?.first_name, owner?.last_name, owner?.email),
    ownerEmail: typeof owner?.email === "string" ? owner.email : null,
    ownerPhone: typeof owner?.phone === "string" ? owner.phone : null,
    activatedAt: toDateString(row.activated_at),
    startDate: toDateString(row.start_date),
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
): Promise<{ total: number; planned: number; active: number; atRisk: number; overdue: number }> {
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
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .or("health.eq.at_risk,status.eq.blocked"),
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
): Promise<{ items: ProjectListItem[]; total: number; page: number; pageSize: number }> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const today = new Date();
  const todayDate = today.toISOString().slice(0, 10);

  const runProjectsListQuery = (columns: string) => {
    let query = supabase
      .from("projects")
      .select(columns, { count: "exact" })
      .order("updated_at", { ascending: false })
      .range(from, to);

    if (params.status === undefined || params.status === null) {
      query = query.not("status", "in", "(completed,canceled)");
    } else if (params.status !== "all") {
      query = query.eq("status", params.status);
    }
    if (params.health === "at_risk") {
      query = query.or("health.eq.at_risk,status.eq.blocked");
    } else if (params.health === "off_track") {
      query = query
        .lt("target_date", todayDate)
        .not("status", "in", "(completed,canceled)");
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
      query = query
        .lt("target_date", todayDate)
        .not("status", "in", "(completed,canceled)");
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

    const [
      statsByProject,
      { data: milestoneRows, error: milestoneRowsError },
    ] = await Promise.all([
      getProjectTaskStats(supabase, ids),
      fetchAllRows((from, to) =>
        supabase.from("project_milestones").select("project_id, status").in("project_id", ids).order("id", { ascending: true }).range(from, to),
      ),
    ]);

    if (milestoneRowsError) throw new Error(milestoneRowsError.message);

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
    });
  }

  return {
    items,
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function listOrgAdminProjectsByProfile(
  supabase: SupabaseClient,
  profileId: string,
  options?: { limit?: number; skipAdminRoleCheck?: boolean },
): Promise<ProjectListItem[]> {
  const limit = typeof options?.limit === "number" && options.limit > 0 ? options.limit : 20;
  let isBegreenAdmin = false;

  if (!options?.skipAdminRoleCheck) {
    const { data: internalAssignments, error: internalAssignmentsError } = await supabase
      .from("user_role_assignments")
      .select("role_code")
      .eq("profile_id", profileId)
      .eq("role_code", "admin");

    if (internalAssignmentsError) throw new Error(internalAssignmentsError.message);
    isBegreenAdmin = (internalAssignments ?? []).some((row) => row.role_code === "admin");
  }

  let data: unknown[] | null = null;
  let error: { message: string } | null = null;

  if (isBegreenAdmin) {
    ({ data, error } = await supabase
      .from("projects")
      .select(PROJECT_SELECT_COLUMNS)
      .order("updated_at", { ascending: false })
      .limit(limit));

    if (error && isMissingProjectCancellationReasonColumnError(error)) {
      ({ data, error } = await supabase
        .from("projects")
        .select(PROJECT_SELECT_COLUMNS_LEGACY)
        .order("updated_at", { ascending: false })
        .limit(limit));
    }
  } else {
    const [
      { data: memberRows, error: memberError },
      { data: ownerRows, error: ownerError },
      orgIds,
    ] = await Promise.all([
      supabase
        .from("project_members")
        .select("project_id")
        .eq("profile_id", profileId),
      supabase
        .from("projects")
        .select("id")
        .eq("owner_profile_id", profileId),
      listOrganizationIdsForProfile(supabase, profileId),
    ]);

    if (memberError) throw new Error(memberError.message);
    if (ownerError) throw new Error(ownerError.message);

    let orgProjectRows: { id: string }[] = [];
    if (orgIds.length > 0) {
      const { data: orgProjects, error: orgProjectsError } = await supabase
        .from("projects")
        .select("id")
        .in("organization_id", orgIds);
      if (orgProjectsError) throw new Error(orgProjectsError.message);
      orgProjectRows = (orgProjects ?? []) as { id: string }[];
    }

    const projectIds = Array.from(new Set([
      ...(memberRows ?? [])
        .map((row) => (typeof row.project_id === "string" ? row.project_id : ""))
        .filter(Boolean),
      ...(ownerRows ?? [])
        .map((row) => (typeof row.id === "string" ? row.id : ""))
        .filter(Boolean),
      ...orgProjectRows
        .map((row) => (typeof row.id === "string" ? row.id : ""))
        .filter(Boolean),
    ]));

    if (projectIds.length === 0) return [];

    ({ data, error } = await supabase
      .from("projects")
      .select(PROJECT_SELECT_COLUMNS)
      .in("id", projectIds)
      .order("updated_at", { ascending: false })
      .limit(limit));

    if (error && isMissingProjectCancellationReasonColumnError(error)) {
      ({ data, error } = await supabase
        .from("projects")
        .select(PROJECT_SELECT_COLUMNS_LEGACY)
        .in("id", projectIds)
        .order("updated_at", { ascending: false })
        .limit(limit));
    }
  }

  if (error) throw new Error(error.message);

  const items = mapRows(data ?? [], normalizeProjectRow);

  // Enrich with task stats + milestone stats
  if (items.length > 0) {
    const ids = items.map((item) => item.id);

    const [
      statsByProject,
      { data: milestoneRows, error: milestoneRowsError },
    ] = await Promise.all([
      getProjectTaskStats(supabase, ids),
      fetchAllRows((from, to) =>
        supabase.from("project_milestones").select("project_id, status").in("project_id", ids).order("id", { ascending: true }).range(from, to),
      ),
    ]);

    if (milestoneRowsError) throw new Error(milestoneRowsError.message);

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

    for (const item of items) {
      const stats = statsByProject.get(item.id);
      if (stats) item.taskStats = stats;
      const mStats = milestoneStatsByProject.get(item.id);
      if (mStats) item.milestoneStats = mStats;
    }
  }

  return items;
}

function normalizeTaskRow(row: Record<string, unknown>): ProjectTask {
  const assigneeRaw = row.assignee;
  const assignee = Array.isArray(assigneeRaw) ? assigneeRaw[0] ?? null : assigneeRaw;
  const reporterRaw = row.reporter;
  const reporter = Array.isArray(reporterRaw) ? reporterRaw[0] ?? null : reporterRaw;

  return {
    id: String(row.id),
    projectId: String(row.project_id),
    milestoneId: typeof row.milestone_id === "string" ? row.milestone_id : null,
    title: typeof row.title === "string" ? row.title : "",
    description: typeof row.description === "string" ? row.description : null,
    status: String(row.status) as ProjectTask["status"],
    health: deriveTaskHealth({
      status: String(row.status) as ProjectTask["status"],
      dueDate: toDateString(row.due_date),
    }),
    priority: String(row.priority) as ProjectTask["priority"],
    assigneeProfileId: typeof row.assignee_profile_id === "string" ? row.assignee_profile_id : null,
    assigneeLabel: profileLabel(assignee?.first_name, assignee?.last_name, assignee?.email),
    reporterProfileId: typeof row.reporter_profile_id === "string" ? row.reporter_profile_id : null,
    reporterLabel: profileLabel(reporter?.first_name, reporter?.last_name, reporter?.email),
    startDate: toDateString(row.start_date),
    dueDate: toDateString(row.due_date),
    position: typeof row.position === "number" ? row.position : 0,
    blockedReason: typeof row.blocked_reason === "string" ? row.blocked_reason : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function normalizeMilestoneRow(row: Record<string, unknown>): ProjectMilestone {
  const status = String(row.status) as ProjectMilestone["status"];
  const targetDate = toDateString(row.target_date);

  return {
    id: String(row.id),
    projectId: String(row.project_id),
    title: typeof row.title === "string" ? row.title : "",
    status,
    health: deriveMilestoneHealth({ status, targetDate }),
    targetDate,
    completedAt: toDateString(row.completed_at),
    position: typeof row.position === "number" ? row.position : 0,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    visibility: row.visibility === "client" ? "client" : "staff",
  };
}

function normalizeLinkRow(row: Record<string, unknown>): ProjectLink {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    label: typeof row.label === "string" ? row.label : "",
    url: typeof row.url === "string" ? row.url : "",
    visibility: String(row.visibility) as ProjectLink["visibility"],
    kind: String(row.kind) as ProjectLink["kind"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listProjectTasks(supabase: SupabaseClient, projectId: string): Promise<ProjectTask[]> {
  const { data, error } = await supabase
    .from("project_tasks")
    .select(
      "id, project_id, milestone_id, title, description, status, priority, assignee_profile_id, reporter_profile_id, start_date, due_date, position, blocked_reason, created_at, updated_at, assignee:profiles!project_tasks_assignee_profile_id_fkey(first_name, last_name, email), reporter:profiles!project_tasks_reporter_profile_id_fkey(first_name, last_name, email)",
    )
    .eq("project_id", projectId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return mapRows(data, normalizeTaskRow);
}

export async function listProjectMilestones(supabase: SupabaseClient, projectId: string): Promise<ProjectMilestone[]> {
  const { data, error } = await supabase
    .from("project_milestones")
    .select("id, project_id, title, status, target_date, completed_at, position, visibility, created_at, updated_at")
    .eq("project_id", projectId)
    .order("target_date", { ascending: true, nullsFirst: false })
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return mapRows(data, normalizeMilestoneRow);
}

export async function listProjectLinks(
  supabase: SupabaseClient,
  projectId: string,
  options?: { clientVisibleOnly?: boolean },
): Promise<ProjectLink[]> {
  let query = supabase
    .from("project_links")
    .select("id, project_id, label, url, visibility, kind, created_at, updated_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (options?.clientVisibleOnly) {
    query = query.eq("visibility", "client");
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return mapRows(data, normalizeLinkRow);
}

function normalizeMemberRows(rows: unknown[]): ProjectDashboardData["members"] {
  return rows.flatMap((row) => {
    const record = toRecord(row);
    if (!record) return [];

    const profileRaw = record.profile;
    const profile = Array.isArray(profileRaw) ? profileRaw[0] ?? null : profileRaw;

    return [{
      id: String(record.id),
      projectId: String(record.project_id),
      profileId: String(record.profile_id),
      role: String(record.role) as ProjectDashboardData["members"][number]["role"],
      createdAt: String(record.created_at),
      label: profileLabel(profile?.first_name, profile?.last_name, profile?.email) ?? "Membro",
      email: typeof profile?.email === "string" ? profile.email : null,
      phone: typeof profile?.phone === "string" ? profile.phone : null,
    }];
  });
}

async function loadInternalProjectProfiles(profileIds: string[]): Promise<Map<string, Record<string, unknown>>> {
  const uniqueProfileIds = Array.from(new Set(profileIds.filter(Boolean)));
  if (uniqueProfileIds.length === 0) return new Map();
  const internalDirectory = createProjectsServiceRoleClient();
  if (!internalDirectory) return new Map();

  const { data, error } = await internalDirectory
    .from("profiles")
    .select("id, first_name, last_name, email")
    .in("id", uniqueProfileIds);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).flatMap((profile) => (
    typeof profile.id === "string"
      ? [[profile.id, profile as Record<string, unknown>] as const]
      : []
  )));
}

async function listProjectMembers(supabase: SupabaseClient, projectId: string): Promise<ProjectDashboardData["members"]> {
  const { data, error } = await supabase
    .from("project_members")
    .select(
      "id, project_id, profile_id, role, created_at, profile:profiles!project_members_profile_id_fkey(first_name, last_name, email)",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const profiles = await loadInternalProjectProfiles(rows.flatMap((row) => (
    typeof row.profile_id === "string" ? [row.profile_id] : []
  )));
  return normalizeMemberRows(rows.map((row) => ({
    ...row,
    profile: typeof row.profile_id === "string" ? profiles.get(row.profile_id) ?? row.profile : row.profile,
  })));
}

async function listProjectParticipatingOrganizations(
  supabase: SupabaseClient,
  projectId: string,
): Promise<Array<{ id: string; name: string; isPrimary: boolean }>> {
  const { data, error } = await supabase
    .from("project_organizations")
    .select("organization_id, is_primary, organization:organizations!project_organizations_organization_id_fkey(name)")
    .eq("project_id", projectId)
    .order("is_primary", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).flatMap((row) => {
    if (typeof row.organization_id !== "string") return [];
    const rawOrganization = Array.isArray(row.organization) ? row.organization[0] : row.organization;
    return [{
      id: row.organization_id,
      name: typeof rawOrganization?.name === "string" ? rawOrganization.name : "Organização",
      isPrimary: row.is_primary === true,
    }];
  });
}

export async function getProjectClientAccessSummary(
  supabase: SupabaseClient,
  projectId: string,
): Promise<ProjectClientAccessSummary> {
  const { data, error } = await supabase.rpc("get_project_client_access_summary", {
    target_project_id: projectId,
  });
  if (error) throw new Error(error.message);
  const item = toRecord(data) ?? {};
  const readiness = toRecord(item.content_readiness) ?? {};
  return {
    mode: String(item.mode ?? "hidden") as ProjectClientAccessSummary["mode"],
    organizationNames: Array.isArray(item.organization_names)
      ? item.organization_names.flatMap((name) => typeof name === "string" ? [name] : [])
      : [],
    organizationCount: typeof item.organization_count === "number" ? item.organization_count : 0,
    selectedClientCount: typeof item.selected_client_count === "number" ? item.selected_client_count : 0,
    contentReadiness: {
      hasSummary: readiness.has_summary === true,
      hasScope: readiness.has_scope === true,
      hasContact: readiness.has_contact === true,
      clientVisibleMilestoneCount: typeof readiness.client_visible_milestone_count === "number"
        ? readiness.client_visible_milestone_count
        : 0,
      sharedDocumentCount: typeof readiness.shared_document_count === "number"
        ? readiness.shared_document_count
        : 0,
    },
  };
}

async function getProjectDashboardProjectRow(supabase: SupabaseClient, projectId: string): Promise<unknown> {
  let { data, error } = await supabase
    .from("projects")
    .select(PROJECT_SELECT_COLUMNS)
    .eq("id", projectId)
    .maybeSingle();

  if (error && isMissingProjectCancellationReasonColumnError(error)) {
    ({ data, error } = await supabase
      .from("projects")
      .select(PROJECT_SELECT_COLUMNS_LEGACY)
      .eq("id", projectId)
      .maybeSingle());
  }

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Projeto não encontrado.");

  const projectRow = data as Record<string, unknown>;
  if (typeof projectRow.owner_profile_id === "string") {
    const profiles = await loadInternalProjectProfiles([projectRow.owner_profile_id]);
    projectRow.owner = profiles.get(projectRow.owner_profile_id) ?? projectRow.owner;
  }

  return projectRow;
}

export async function getProjectDashboard(
  supabase: SupabaseClient,
  projectId: string,
  /** @deprecated The dashboard is internal-only. Use getClientProject for client routes. */
  options?: { clientVisibleOnly?: boolean },
): Promise<ProjectDashboardData> {
  if (options?.clientVisibleOnly) {
    throw new Error("getProjectDashboard is internal-only. Use getClientProject for client-safe project data.");
  }
  const [data, tasks, milestones, links, members, activity, participatingOrganizations, clientAccessSummary] = await Promise.all([
    getProjectDashboardProjectRow(supabase, projectId),
    listProjectTasks(supabase, projectId),
    listProjectMilestones(supabase, projectId),
    listProjectLinks(supabase, projectId),
    listProjectMembers(supabase, projectId),
    queryProjectActivity(supabase, projectId, { page: 1, pageSize: 3 }),
    listProjectParticipatingOrganizations(supabase, projectId),
    getProjectClientAccessSummary(supabase, projectId),
  ]);

  const projectRecord = toRecord(data);
  if (!projectRecord) throw new Error("Projeto não encontrado.");
  const project = normalizeProjectRow(projectRecord);
  project.participatingOrganizations = participatingOrganizations.length > 0
    ? participatingOrganizations
    : project.participatingOrganizations;
  project.clientAccessSummary = clientAccessSummary;
  project.taskStats.total = tasks.length;
  project.taskStats.done = tasks.filter((task) => task.status === "done").length;
  project.taskStats.blocked = tasks.filter((task) => task.status === "blocked").length;
  const today = new Date().toISOString().slice(0, 10);
  project.taskStats.overdue = tasks.filter((task) => task.dueDate && task.dueDate < today && task.status !== "done").length;
  project.milestoneStats.total = milestones.length;
  project.milestoneStats.achieved = milestones.filter((m) => m.status === "achieved").length;
  project.milestoneStats.delayed = milestones.filter((m) => m.status === "delayed").length;
  project.health = deriveProjectHealth(project);
  return {
    project,
    members,
    milestones,
    tasks,
    links,
    activity: activity.items,
    activityTotal: activity.total,
  };
}

type ActivityEventRow = {
  id: string;
  created_at: string;
  event_type: string;
  summary: string;
  payload: unknown;
  actor_profile_id: string | null;
};

async function hydrateProjectActivityRows(
  supabase: SupabaseClient,
  rows: ActivityEventRow[],
): Promise<ProjectActivityItem[]> {
  // Every profile referenced anywhere — the actor plus the member profiles named
  // in member_*/project_members_synced payloads — resolved in one query so the
  // feed can speak people by name instead of leaving raw ids or "Sistema".
  const profileIds = new Set<string>();
  const collect = (value: unknown) => {
    if (typeof value === "string" && value) profileIds.add(value);
    else if (Array.isArray(value)) for (const entry of value) collect(entry);
  };
  for (const row of rows) {
    collect(row.actor_profile_id);
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    collect(payload.profile_id);
    collect(payload.added_profile_ids);
    collect(payload.removed_profile_ids);
    collect(payload.changed_profile_ids);
  }

  const labelsById = new Map<string, string>();
  if (profileIds.size > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", Array.from(profileIds));

    for (const profile of profiles ?? []) {
      if (typeof profile.id !== "string") continue;
      const label = profileLabel(profile.first_name, profile.last_name, profile.email);
      if (label) labelsById.set(profile.id, label);
    }
  }

  const namesFor = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value
      .map((id) => (typeof id === "string" ? labelsById.get(id) ?? null : null))
      .filter((name): name is string => Boolean(name));
  };

  return rows.map((row) => {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const profileId = typeof payload.profile_id === "string" ? payload.profile_id : null;
    // Enrich the payload with resolved names so the client renders people, not ids.
    const enrichedPayload: Record<string, unknown> = {
      ...payload,
      ...(profileId && labelsById.has(profileId)
        ? { profile_name: labelsById.get(profileId) }
        : {}),
      added_profile_names: namesFor(payload.added_profile_ids),
      removed_profile_names: namesFor(payload.removed_profile_ids),
      changed_profile_names: namesFor(payload.changed_profile_ids),
    };

    return {
      id: String(row.id),
      createdAt: String(row.created_at),
      eventType: String(row.event_type),
      actorProfileId: typeof row.actor_profile_id === "string" ? row.actor_profile_id : null,
      actorLabel:
        typeof row.actor_profile_id === "string"
          ? (labelsById.get(row.actor_profile_id) ?? null)
          : null,
      summary: String(row.summary),
      payload: enrichedPayload,
    };
  });
}

export async function queryProjectActivity(
  supabase: SupabaseClient,
  projectId: string,
  query: { page?: number; pageSize?: number } = {},
): Promise<ProjectActivityPage> {
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(query.pageSize ?? 50)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const columns = "id, created_at, event_type, summary, payload, actor_profile_id";

  // Activity can identify a project through the canonical payload or the legacy
  // direct entity columns. Query both safely, then subtract their exact overlap.
  const [payloadProjectEvents, directProjectEvents, overlappingEvents] = await Promise.all([
    supabase
      .from("app_activity_events")
      .select(columns, { count: "exact" })
      .eq("domain", "projects")
      .filter("payload->>project_id", "eq", projectId)
      .order("created_at", { ascending: false })
      .range(0, to),
    supabase
      .from("app_activity_events")
      .select(columns, { count: "exact" })
      .eq("domain", "projects")
      .eq("entity_table", "projects")
      .eq("entity_id", projectId)
      .order("created_at", { ascending: false })
      .range(0, to),
    supabase
      .from("app_activity_events")
      .select("id", { count: "exact", head: true })
      .eq("domain", "projects")
      .filter("payload->>project_id", "eq", projectId)
      .eq("entity_table", "projects")
      .eq("entity_id", projectId),
  ]);

  if (payloadProjectEvents.error) throw new Error(payloadProjectEvents.error.message);
  if (directProjectEvents.error) throw new Error(directProjectEvents.error.message);
  if (overlappingEvents.error) throw new Error(overlappingEvents.error.message);

  const rowsById = new Map<string, ActivityEventRow>();
  for (const row of [
    ...((payloadProjectEvents.data ?? []) as ActivityEventRow[]),
    ...((directProjectEvents.data ?? []) as ActivityEventRow[]),
  ]) {
    rowsById.set(String(row.id), row);
  }

  const rows = Array.from(rowsById.values())
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(from, to + 1);
  const total = Math.max(
    0,
    (payloadProjectEvents.count ?? 0)
      + (directProjectEvents.count ?? 0)
      - (overlappingEvents.count ?? 0),
  );

  return {
    items: await hydrateProjectActivityRows(supabase, rows),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function listProjectActivity(
  supabase: SupabaseClient,
  projectId: string,
): Promise<ProjectActivityItem[]> {
  return (await queryProjectActivity(supabase, projectId)).items;
}

export async function createProject(supabase: SupabaseClient, input: CreateProjectInput) {
  const cancellationReason = input.cancellationReason?.trim() || null;
  if (input.startDate && input.targetDate && input.targetDate < input.startDate) {
    throw new Error("A data alvo não pode ser anterior à data de início.");
  }
  if (input.status === "canceled" && !cancellationReason) {
    throw new Error("Indica o motivo do cancelamento.");
  }

  let codeToPersist: string | null = input.code?.trim().toUpperCase() || null;

  if (!codeToPersist) {
    const { data: organization, error: organizationError } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", input.organizationId)
      .maybeSingle<{ name: string }>();

    if (organizationError) throw new Error(organizationError.message);
    if (!organization?.name) throw new Error("Organização não encontrada.");

    const generatedBase = buildProjectCodeBase(organization.name, input.name);
    codeToPersist = await resolveUniqueGeneratedProjectCode(supabase, generatedBase);
  }

  const payload = {
    organization_id: input.organizationId,
    name: input.name.trim(),
    code: codeToPersist,
    status: input.status ?? "planned",
    health: deriveProjectHealth({
      status: input.status ?? "planned",
      targetDate: input.targetDate ?? null,
      taskStats: { total: 0, done: 0, overdue: 0, blocked: 0 },
    }),
    owner_profile_id: input.ownerProfileId ?? null,
    start_date: input.startDate ?? null,
    target_date: input.targetDate ?? null,
    cancellation_reason: input.status === "canceled" ? cancellationReason : null,
    summary: input.summary?.trim() || null,
  };

  let { data, error } = await supabase
    .from("projects")
    .insert(payload)
    .select("id")
    .single<{ id: string }>();

  if (error && isMissingProjectCancellationReasonColumnError(error)) {
    const { cancellation_reason: legacyCancellationReason, ...legacyPayload } = payload;
    void legacyCancellationReason;
    ({ data, error } = await supabase
      .from("projects")
      .insert(legacyPayload)
      .select("id")
      .single<{ id: string }>());
  }

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Não foi possível criar o projeto.");
  await syncProjectMembers(supabase, data.id, []);
  return getProjectDashboard(supabase, data.id);
}

export async function createProjectOrganization(supabase: SupabaseClient, input: CreateProjectOrganizationInput) {
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new Error("name é obrigatório.");
  }

  const composeAddress = [input.addressLine1, input.addressLine2, input.zipCode, input.country]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(ORGANIZATION_ADDRESS_SEPARATOR);

  const { data, error } = await supabase
    .from("organizations")
    .insert({
      name: trimmedName,
      primary_contact_id: input.primaryContactId || null,
      industry: input.industry?.trim() || null,
      company_size: input.companySize?.trim() || null,
      budget_range: input.budgetRange?.trim() || null,
      website_url: input.websiteUrl?.trim() || null,
      address: composeAddress || null,
      tax_identifier_value: input.taxIdentifierValue?.replace(/\D/g, "") || null,
      tax_identifier_kind: input.taxIdentifierValue?.trim() ? "vat" : null,
      tax_identifier_country_code: input.taxIdentifierValue?.trim() ? "PT" : null,
    })
    .select("id, name")
    .single<{ id: string; name: string }>();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateProject(supabase: SupabaseClient, projectId: string, input: UpdateProjectInput) {
  const payload: Record<string, unknown> = {};
  const cancellationReason = input.cancellationReason?.trim() || null;

  if (typeof input.startDate !== "undefined" || typeof input.targetDate !== "undefined") {
    const { data: currentDates, error: datesError } = await supabase
      .from("projects")
      .select("start_date, target_date")
      .eq("id", projectId)
      .maybeSingle<{ start_date: string | null; target_date: string | null }>();
    if (datesError) throw new Error(datesError.message);
    if (!currentDates) throw new Error("Projeto não encontrado.");
    const nextStartDate = typeof input.startDate === "undefined" ? currentDates.start_date : input.startDate || null;
    const nextTargetDate = typeof input.targetDate === "undefined" ? currentDates.target_date : input.targetDate || null;
    if (nextStartDate && nextTargetDate && nextTargetDate < nextStartDate) {
      throw new Error("A data alvo não pode ser anterior à data de início.");
    }
  }

  if (input.status === "canceled" && !cancellationReason) {
    throw new Error("Indica o motivo do cancelamento.");
  }

  if (typeof input.name === "string") payload.name = input.name.trim();
  if (typeof input.code !== "undefined") payload.code = input.code?.trim() || null;
  if (typeof input.status !== "undefined") payload.status = input.status;
  if (typeof input.ownerProfileId !== "undefined") payload.owner_profile_id = input.ownerProfileId || null;
  if (typeof input.startDate !== "undefined") payload.start_date = input.startDate || null;
  if (typeof input.targetDate !== "undefined") payload.target_date = input.targetDate || null;
  if (typeof input.cancellationReason !== "undefined") payload.cancellation_reason = cancellationReason;
  if (typeof input.status !== "undefined" && input.status !== "canceled") payload.cancellation_reason = null;
  if (typeof input.summary !== "undefined") payload.summary = input.summary?.trim() || null;

  let { error } = await supabase
    .from("projects")
    .update(payload)
    .eq("id", projectId);

  if (error && isMissingProjectCancellationReasonColumnError(error)) {
    const { cancellation_reason: legacyCancellationReason, ...legacyPayload } = payload;
    void legacyCancellationReason;
    ({ error } = await supabase
      .from("projects")
      .update(legacyPayload)
      .eq("id", projectId));
  }

  if (error) throw new Error(error.message);
  await syncProjectHealth(supabase, projectId);
  return getProjectDashboard(supabase, projectId);
}

export async function deleteProject(supabase: SupabaseClient, projectId: string, actorProfileId: string | null) {
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name, organization_id, owner_profile_id")
    .eq("id", projectId)
    .maybeSingle<{
      id: string;
      name: string;
      organization_id: string | null;
      owner_profile_id: string | null;
    }>();

  if (projectError) throw new Error(projectError.message);
  if (!project?.id) throw new Error("Projeto não encontrado.");

  const [
    { data: projectMembers, error: projectMembersError },
    { data: organizationMembers, error: organizationMembersError },
  ] = await Promise.all([
    supabase
      .from("project_members")
      .select("profile_id")
      .eq("project_id", projectId),
    project.organization_id
      ? supabase
        .from("organization_members")
        .select("profile_id")
        .eq("organization_id", project.organization_id)
        .eq("role", "admin")
      : Promise.resolve({
        data: [] as Array<{ profile_id: string | null }>,
        error: null,
      }),
  ]);
  if (projectMembersError) throw new Error(projectMembersError.message);
  if (organizationMembersError) throw new Error(organizationMembersError.message);

  const visibleProfileIds = Array.from(new Set([
    project.owner_profile_id,
    ...(projectMembers ?? []).map((member) => member.profile_id),
    ...(organizationMembers ?? []).map((member) => member.profile_id),
  ].filter((profileId): profileId is string => typeof profileId === "string" && profileId.length > 0)));

  const { data: deletedRows, error: deleteError } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .select("id");

  if (deleteError) throw new Error(deleteError.message);
  if (!deletedRows?.some((row) => row.id === projectId)) throw new Error("Projeto não encontrado.");

  await logProjectActivityEvent({
    eventType: "projects.project.deleted",
    entityId: projectId,
    projectId,
    summary: `Projeto eliminado: ${project.name}`,
    actorProfileId,
    payload: {
      project_id: projectId,
      project_name: project.name,
      organization_id: project.organization_id,
      deleted_by_profile_id: actorProfileId,
      visible_profile_ids: visibleProfileIds,
    },
  });
}

export type ProjectAccessRole = "admin" | "owner" | "contributor" | "observer";

export async function getProjectAccess(
  supabase: SupabaseClient,
  projectId: string,
  profileId: string,
  globalRole: string | null,
): Promise<{
  projectRole: ProjectAccessRole;
  permissions: {
    canOpenEditProject: boolean;
    canEditProjectItems: boolean;
    canUpdateAssignedTasks: boolean;
    canCreateProjectLinks: boolean;
    canManageProjectLinks: boolean;
    canManageClientContent: boolean;
    canManageMembers: boolean;
    canViewOrganization: boolean;
  };
  viewerProfileId: string;
}> {
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, owner_profile_id")
    .eq("id", projectId)
    .maybeSingle<{ id: string; owner_profile_id: string | null }>();
  if (projectError) throw new Error(projectError.message);
  if (!project) throw new Error("Projeto não encontrado.");

  let projectRole: ProjectAccessRole = "observer";
  if (globalRole === "admin") {
    projectRole = "admin";
  } else if (project.owner_profile_id === profileId) {
    projectRole = "owner";
  } else {
    const { data: membership, error: membershipError } = await supabase
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("profile_id", profileId)
      .maybeSingle<{ role: "owner" | "contributor" | "observer" }>();
    if (membershipError) throw new Error(membershipError.message);
    if (membership?.role) projectRole = membership.role;
  }

  const canManageProject = projectRole === "admin" || projectRole === "owner";
  return {
    projectRole,
    viewerProfileId: profileId,
    permissions: {
      canOpenEditProject: canManageProject,
      canEditProjectItems: canManageProject,
      canUpdateAssignedTasks: projectRole === "contributor",
      canCreateProjectLinks: canManageProject,
      canManageProjectLinks: canManageProject,
      canManageClientContent: canManageProject,
      canManageMembers: canManageProject,
      canViewOrganization: true,
    },
  };
}

export async function getProjectTaskAssignment(
  supabase: SupabaseClient,
  projectId: string,
  taskId: string,
): Promise<{ assigneeProfileId: string | null } | null> {
  const { data, error } = await supabase
    .from("project_tasks")
    .select("assignee_profile_id")
    .eq("project_id", projectId)
    .eq("id", taskId)
    .maybeSingle<{ assignee_profile_id: string | null }>();
  if (error) throw new Error(error.message);
  return data ? { assigneeProfileId: data.assignee_profile_id } : null;
}

async function nextPosition(supabase: SupabaseClient, table: "project_tasks" | "project_milestones", projectId: string) {
  const { data } = await supabase
    .from(table)
    .select("position")
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle<{ position: number }>();

  return typeof data?.position === "number" ? data.position + 1 : 0;
}

export async function createProjectTask(supabase: SupabaseClient, projectId: string, input: CreateProjectTaskInput) {
  const position = await nextPosition(supabase, "project_tasks", projectId);
  const status = input.status ?? "todo";
  const blockedReason = input.blockedReason?.trim() || null;
  if (status === "blocked" && !blockedReason) {
    throw new Error("Motivo de bloqueio é obrigatório quando a tarefa está bloqueada.");
  }
  if (input.startDate && input.dueDate && input.dueDate < input.startDate) {
    throw new Error("A data limite não pode ser anterior à data de início.");
  }
  const payload = {
    project_id: projectId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    milestone_id: input.milestoneId ?? null,
    status,
    priority: input.priority ?? "medium",
    assignee_profile_id: input.assigneeProfileId ?? null,
    reporter_profile_id: input.reporterProfileId ?? null,
    start_date: input.startDate ?? null,
    due_date: input.dueDate ?? null,
    blocked_reason: status === "blocked" ? blockedReason : null,
    position,
  };

  const { data, error } = await supabase
    .from("project_tasks")
    .insert(payload)
    .select(
      "id, project_id, milestone_id, title, description, status, priority, assignee_profile_id, reporter_profile_id, start_date, due_date, position, blocked_reason, created_at, updated_at, assignee:profiles!project_tasks_assignee_profile_id_fkey(first_name, last_name, email), reporter:profiles!project_tasks_reporter_profile_id_fkey(first_name, last_name, email)",
    )
    .single();
  if (error) throw new Error(error.message);
  await syncProjectHealth(supabase, projectId);
  const record = toRecord(data);
  if (!record) throw new Error("Não foi possível criar a tarefa.");
  return normalizeTaskRow(record);
}

export async function updateProjectTask(
  supabase: SupabaseClient,
  projectId: string,
  taskId: string,
  input: UpdateProjectTaskInput,
) {
  if (typeof input.startDate !== "undefined" || typeof input.dueDate !== "undefined") {
    const { data: currentDates, error: currentDatesError } = await supabase
      .from("project_tasks")
      .select("start_date, due_date")
      .eq("id", taskId)
      .eq("project_id", projectId)
      .maybeSingle<{ start_date: string | null; due_date: string | null }>();
    if (currentDatesError) throw new Error(currentDatesError.message);
    const startDate = typeof input.startDate === "undefined" ? currentDates?.start_date ?? null : input.startDate || null;
    const dueDate = typeof input.dueDate === "undefined" ? currentDates?.due_date ?? null : input.dueDate || null;
    if (startDate && dueDate && dueDate < startDate) {
      throw new Error("A data limite não pode ser anterior à data de início.");
    }
  }
  const nextStatus = typeof input.status !== "undefined" ? input.status : null;
  const nextBlockedReason = typeof input.blockedReason !== "undefined" ? input.blockedReason?.trim() || null : undefined;
  if (nextStatus === "blocked") {
    if (typeof nextBlockedReason !== "undefined" && !nextBlockedReason) {
      throw new Error("Motivo de bloqueio é obrigatório quando a tarefa está bloqueada.");
    }

    if (typeof nextBlockedReason === "undefined") {
      const { data: currentTask, error: currentTaskError } = await supabase
        .from("project_tasks")
        .select("blocked_reason")
        .eq("id", taskId)
        .eq("project_id", projectId)
        .maybeSingle<{ blocked_reason: string | null }>();

      if (currentTaskError) throw new Error(currentTaskError.message);
      if (!currentTask?.blocked_reason?.trim()) {
        throw new Error("Motivo de bloqueio é obrigatório quando a tarefa está bloqueada.");
      }
    }
  }

  const payload: Record<string, unknown> = {};

  if (typeof input.title === "string") payload.title = input.title.trim();
  if (typeof input.description !== "undefined") payload.description = input.description?.trim() || null;
  if (typeof input.milestoneId !== "undefined") payload.milestone_id = input.milestoneId || null;
  if (typeof input.status !== "undefined") payload.status = input.status;
  if (typeof input.priority !== "undefined") payload.priority = input.priority;
  if (typeof input.assigneeProfileId !== "undefined") payload.assignee_profile_id = input.assigneeProfileId || null;
  if (typeof input.reporterProfileId !== "undefined") payload.reporter_profile_id = input.reporterProfileId || null;
  if (typeof input.startDate !== "undefined") payload.start_date = input.startDate || null;
  if (typeof input.dueDate !== "undefined") payload.due_date = input.dueDate || null;
  if (typeof input.position === "number") payload.position = input.position;
  if (typeof nextBlockedReason !== "undefined") payload.blocked_reason = nextBlockedReason;
  if (nextStatus !== null && nextStatus !== "blocked") payload.blocked_reason = null;

  const { error } = await supabase
    .from("project_tasks")
    .update(payload)
    .eq("id", taskId)
    .eq("project_id", projectId);

  if (error) throw new Error(error.message);
  await syncProjectHealth(supabase, projectId);
  return listProjectTasks(supabase, projectId);
}

export async function createProjectMilestone(supabase: SupabaseClient, projectId: string, input: CreateProjectMilestoneInput) {
  const position = await nextPosition(supabase, "project_milestones", projectId);

  const { error } = await supabase
    .from("project_milestones")
    .insert({
      project_id: projectId,
      title: input.title.trim(),
      status: input.status ?? "pending",
      target_date: input.targetDate ?? null,
      visibility: input.visibility ?? "staff",
      position,
    });

  if (error) throw new Error(error.message);
  await syncProjectHealth(supabase, projectId);
  return listProjectMilestones(supabase, projectId);
}

export async function updateProjectMilestone(
  supabase: SupabaseClient,
  projectId: string,
  milestoneId: string,
  input: UpdateProjectMilestoneInput,
) {
  const payload: Record<string, unknown> = {};

  if (typeof input.title === "string") payload.title = input.title.trim();
  if (typeof input.status !== "undefined") payload.status = input.status;
  if (typeof input.targetDate !== "undefined") payload.target_date = input.targetDate || null;
  if (typeof input.completedAt !== "undefined") payload.completed_at = input.completedAt || null;
  if (typeof input.position === "number") payload.position = input.position;
  if (typeof input.visibility !== "undefined") payload.visibility = input.visibility;

  const { error } = await supabase
    .from("project_milestones")
    .update(payload)
    .eq("id", milestoneId)
    .eq("project_id", projectId);

  if (error) throw new Error(error.message);
  await syncProjectHealth(supabase, projectId);
  return listProjectMilestones(supabase, projectId);
}

export async function deleteProjectMilestone(supabase: SupabaseClient, projectId: string, milestoneId: string) {
  const { data: deletedRows, error } = await supabase
    .from("project_milestones")
    .delete()
    .eq("id", milestoneId)
    .eq("project_id", projectId)
    .select("id");

  if (error) throw new Error(error.message);
  if (!deletedRows?.some((row) => row.id === milestoneId)) throw new Error("Meta não encontrada.");
  await syncProjectHealth(supabase, projectId);
  return listProjectMilestones(supabase, projectId);
}

async function syncProjectHealth(supabase: SupabaseClient, projectId: string) {
  const [{ data: project, error: projectError }, { data: taskRows, error: tasksError }] = await Promise.all([
    supabase
      .from("projects")
      .select("status, target_date")
      .eq("id", projectId)
      .maybeSingle<{ status: ProjectListItem["status"]; target_date: string | null }>(),
    supabase
      .from("project_tasks")
      .select("status, due_date")
      .eq("project_id", projectId),
  ]);

  if (projectError) throw new Error(projectError.message);
  if (tasksError) throw new Error(tasksError.message);
  if (!project) return;

  const today = new Date().toISOString().slice(0, 10);
  const taskStats = {
    total: 0,
    done: 0,
    overdue: 0,
    blocked: 0,
  };

  for (const row of taskRows ?? []) {
    taskStats.total += 1;
    if (row.status === "done") taskStats.done += 1;
    if (row.status === "blocked") taskStats.blocked += 1;
    if (typeof row.due_date === "string" && row.due_date < today && row.status !== "done") taskStats.overdue += 1;
  }

  const nextHealth = deriveProjectHealth({
    status: project.status,
    targetDate: project.target_date,
    taskStats,
  });

  const { error: updateError } = await supabase
    .from("projects")
    .update({ health: nextHealth })
    .eq("id", projectId);

  if (updateError) throw new Error(updateError.message);
}

export async function createProjectLink(supabase: SupabaseClient, projectId: string, input: CreateProjectLinkInput) {
  const { error } = await supabase
    .from("project_links")
    .insert({
      project_id: projectId,
      label: input.label.trim(),
      url: input.url.trim(),
      visibility: input.visibility ?? "staff",
      kind: input.kind ?? "other",
    });

  if (error) throw new Error(error.message);
  return listProjectLinks(supabase, projectId);
}

export async function updateProjectLink(
  supabase: SupabaseClient,
  projectId: string,
  linkId: string,
  input: UpdateProjectLinkInput,
) {
  const payload: Record<string, unknown> = {};
  if (typeof input.label === "string") payload.label = input.label.trim();
  if (typeof input.url === "string") payload.url = input.url.trim();
  if (typeof input.visibility !== "undefined") payload.visibility = input.visibility;
  if (typeof input.kind !== "undefined") payload.kind = input.kind;

  const { error } = await supabase
    .from("project_links")
    .update(payload)
    .eq("id", linkId)
    .eq("project_id", projectId);

  if (error) throw new Error(error.message);
  return listProjectLinks(supabase, projectId);
}

export async function deleteProjectTask(supabase: SupabaseClient, projectId: string, taskId: string) {
  const { data: deletedRows, error } = await supabase
    .from("project_tasks")
    .delete()
    .eq("id", taskId)
    .eq("project_id", projectId)
    .select("id");

  if (error) throw new Error(error.message);
  if (!deletedRows?.some((row) => row.id === taskId)) throw new Error("Tarefa não encontrada.");
  await syncProjectHealth(supabase, projectId);
  return listProjectTasks(supabase, projectId);
}

export async function deleteProjectLink(supabase: SupabaseClient, projectId: string, linkId: string) {
  const { data: deletedRows, error } = await supabase
    .from("project_links")
    .delete()
    .eq("id", linkId)
    .eq("project_id", projectId)
    .select("id");

  if (error) throw new Error(error.message);
  if (!deletedRows?.some((row) => row.id === linkId)) throw new Error("Ligação não encontrada.");
  return listProjectLinks(supabase, projectId);
}

/** @deprecated Use getClientProject() and the dedicated client DTO. */
export async function getClientProjectHealth(supabase: SupabaseClient, projectId: string) {
  const safeProject = await getClientProject(supabase, projectId);
  if (!safeProject) throw new Error("Projeto não encontrado.");

  const milestones: ProjectMilestone[] = safeProject.metas.map((meta) => ({
    id: meta.id,
    projectId: safeProject.id,
    title: meta.title,
    status: meta.status,
    health: meta.status === "delayed" ? "off_track" : "on_track",
    targetDate: meta.targetDate,
    completedAt: meta.completedAt,
    position: meta.position,
    visibility: "client",
    createdAt: "",
    updatedAt: meta.completedAt ?? meta.targetDate ?? "",
  }));
  const links: ProjectLink[] = safeProject.documents.map((document) => ({
    id: document.id,
    projectId: safeProject.id,
    label: document.label,
    url: document.url,
    visibility: "client",
    kind: document.kind,
    createdAt: document.createdAt,
    updatedAt: document.createdAt,
  }));
  const contact = safeProject.clientContact;
  const project: ProjectListItem = {
    id: safeProject.id,
    organizationId: safeProject.organizations[0]?.id ?? "",
    organizationName: safeProject.organizations[0]?.name ?? "Organização",
    organizationOwnerLabel: null,
    organizationOwnerEmail: null,
    organizationOwnerPhone: null,
    participatingOrganizations: safeProject.organizations.map((organization, index) => ({
      ...organization,
      isPrimary: index === 0,
    })),
    name: safeProject.name,
    code: safeProject.reference,
    status: safeProject.status,
    health: ["blocked", "canceled"].includes(safeProject.status) ? "off_track" : "on_track",
    ownerProfileId: contact?.profileId ?? null,
    ownerLabel: contact?.label ?? null,
    ownerEmail: contact?.email ?? null,
    ownerPhone: null,
    activatedAt: safeProject.startDate,
    startDate: safeProject.startDate,
    targetDate: safeProject.targetDate,
    completedAt: safeProject.completedAt,
    cancellationReason: null,
    summary: safeProject.clientSummary,
    createdAt: safeProject.startDate ?? "",
    updatedAt: safeProject.completedAt ?? safeProject.targetDate ?? safeProject.startDate ?? "",
    taskStats: { total: 0, done: 0, overdue: 0, blocked: 0 },
    milestoneStats: {
      total: milestones.length,
      achieved: milestones.filter((milestone) => milestone.status === "achieved").length,
      delayed: milestones.filter((milestone) => milestone.status === "delayed").length,
    },
  };

  return {
    project,
    members: [] as ProjectMember[],
    milestones,
    links,
    taskStats: project.taskStats,
    nextMilestone:
      milestones
        .filter((milestone) => milestone.status !== "achieved")
        .toSorted((a, b) => (a.targetDate ?? "9999-12-31").localeCompare(b.targetDate ?? "9999-12-31"))[0] ?? null,
  };
}

// Project membership alone cannot distinguish an internal observer from a
// client, so global roles provide the internal/team bucket.
export async function resolveProjectMemberColors(
  supabase: SupabaseClient,
  members: readonly Pick<ProjectMember, "profileId" | "role">[],
  ownerProfileId: string | null,
): Promise<Record<string, ProjectMemberColor>> {
  const profileIds = Array.from(new Set(members.map((member) => member.profileId)));
  const internal = new Set<string>();

  if (profileIds.length > 0) {
    const { data, error } = await supabase
      .from("user_role_assignments")
      .select("profile_id, role_code")
      .in("profile_id", profileIds)
      .in("role_code", ["staff", "admin"]);
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as { profile_id: string }[]) {
      internal.add(row.profile_id);
    }
  }

  const colors: Record<string, ProjectMemberColor> = {};
  for (const member of members) {
    if (member.profileId === ownerProfileId || member.role === "owner") {
      colors[member.profileId] = "manager";
    } else if (internal.has(member.profileId)) {
      colors[member.profileId] = "team";
    } else {
      colors[member.profileId] = "client";
    }
  }

  return colors;
}

export async function listProjectAssignableProfiles(
  supabase: SupabaseClient,
  projectId: string,
): Promise<ProjectAssignableProfile[]> {
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, organization_id")
    .eq("id", projectId)
    .maybeSingle<{ id: string; organization_id: string | null }>();

  if (projectError) throw new Error(projectError.message);
  if (!project?.id || !project.organization_id) throw new Error("Projeto não encontrado.");

  // Candidate identities are an internal management concern. Profiles are
  // deliberately self-visible under normal RLS, so resolve only staff/admin
  // candidates with a server-only client after the HTTP layer has verified
  // that the caller is a global admin or this project's owner.
  const internalDirectory = createProjectsServiceRoleClient();
  if (!internalDirectory) {
    throw new Error("Não foi possível carregar as pessoas elegíveis para a equipa interna.");
  }

  const [
    { data: roleAssignments, error: roleAssignmentsError },
    projectMembers,
  ] = await Promise.all([
    internalDirectory
      .from("user_role_assignments")
      .select(
        "profile_id, role_code, profile:profiles!user_role_assignments_profile_id_fkey(first_name, last_name, email)",
      )
      .in("role_code", ["staff", "admin"])
      .order("assigned_at", { ascending: false }),
    listProjectMembers(internalDirectory, projectId),
  ]);

  if (roleAssignmentsError) throw new Error(roleAssignmentsError.message);

  const projectRoleByProfile = new Map(
    projectMembers.map((member) => [member.profileId, member.role] as const),
  );

  const internalOptions: ProjectAssignableProfile[] = (roleAssignments ?? []).flatMap((row) => {
    const profileRaw = row.profile;
    const profile = Array.isArray(profileRaw) ? profileRaw[0] ?? null : profileRaw;
    const profileId = typeof row.profile_id === "string" ? row.profile_id : "";
    const roleCode: ProjectAssignableProfile["organizationRole"] | null =
      row.role_code === "admin" ? "admin" : row.role_code === "staff" ? "staff" : null;
    if (!roleCode || !profileId) return [];

    return [{
      profileId,
      label: profileLabel(profile?.first_name, profile?.last_name, profile?.email) ?? "Membro",
      email: typeof profile?.email === "string" ? profile.email : null,
      organizationRole: roleCode,
      projectRole: projectRoleByProfile.get(profileId) ?? null,
    }];
  });

  const options = internalOptions;
  const uniqueByProfile = new Map<string, ProjectAssignableProfile>();
  for (const option of options) {
    if (!uniqueByProfile.has(option.profileId)) uniqueByProfile.set(option.profileId, option);
  }

  return Array.from(uniqueByProfile.values())
    .filter((item) => item.profileId.length > 0)
    .toSorted((a, b) => a.label.localeCompare(b.label, "pt-PT"));
}

export async function listProjectSetupOptionsForManagement(
  _supabase: SupabaseClient,
  currentProfileId: string,
  organizationIds: string[],
): Promise<ProjectSetupOptions> {
  // The HTTP layer has already verified that the caller is staff/admin.
  // Creation must resolve the same internal and client identities as the
  // existing-project editors, without widening authenticated profile RLS.
  const internalDirectory = createProjectsServiceRoleClient();
  if (!internalDirectory) {
    throw new Error("Não foi possível carregar as pessoas elegíveis para o projeto.");
  }
  return listProjectSetupOptionsFromDirectory(
    internalDirectory,
    currentProfileId,
    organizationIds,
  );
}

export async function syncProjectMembers(
  supabase: SupabaseClient,
  projectId: string,
  input: ProjectMemberInput[],
) {
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, organization_id, owner_profile_id")
    .eq("id", projectId)
    .maybeSingle<{ id: string; organization_id: string; owner_profile_id: string | null }>();

  if (projectError) throw new Error(projectError.message);
  if (!project?.id || !project.organization_id) throw new Error("Projeto não encontrado.");

  const { data: internalRoles, error: internalRolesError } = await supabase
    .from("user_role_assignments")
    .select("profile_id, role_code")
    .in("role_code", ["staff", "admin"]);

  if (internalRolesError) throw new Error(internalRolesError.message);

  const allowedProfileIds = new Set(
    (internalRoles ?? [])
      .map((row) => (typeof row.profile_id === "string" ? row.profile_id : ""))
      .filter(Boolean),
  );
  if (input.some((item) => !allowedProfileIds.has(item.profileId))) {
    throw new Error("A equipa interna só pode incluir administradores e membros de staff.");
  }

  const membersToPersist = input
    .map((item) => ({
      project_id: projectId,
      profile_id: item.profileId,
      role: item.role,
    }));
  const finalMembersToPersist = Array.from(
    new Map(membersToPersist.map((member) => [member.profile_id, member])).values(),
  );
  const selectedOwnerProfileId = finalMembersToPersist.find((member) => member.role === "owner")?.profile_id ?? null;
  const { error: syncError } = await supabase.rpc("sync_project_members_exact", {
    p_project_id: projectId,
    p_members: finalMembersToPersist.map((member) => ({
      profile_id: member.profile_id,
      role: member.role,
    })),
    p_owner_profile_id: selectedOwnerProfileId,
  });
  if (syncError) throw new Error(syncError.message);

  return listProjectMembers(supabase, projectId);
}
