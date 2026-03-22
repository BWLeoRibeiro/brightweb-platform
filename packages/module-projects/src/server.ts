import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import {
  type CreateProjectInput,
  type CreateProjectOrganizationInput,
  type CreateProjectLinkInput,
  type CreateProjectMilestoneInput,
  type CreateProjectTaskInput,
  type ListProjectsParams,
  type ProjectAssignableProfile,
  type ProjectDashboardData,
  type ProjectLink,
  type ProjectListItem,
  type ProjectMilestone,
  type ProjectMemberInput,
  type ProjectTask,
  type UpdateProjectInput,
  type UpdateProjectLinkInput,
  type UpdateProjectMilestoneInput,
  type UpdateProjectTaskInput,
} from "./types";

const ORGANIZATION_ADDRESS_SEPARATOR = " | ";
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const PROJECT_SELECT_COLUMNS = "id, organization_id, name, code, status, health, owner_profile_id, activated_at, target_date, completed_at, cancellation_reason, summary, created_at, updated_at, organizations(name, primary_contact:profiles!organizations_primary_contact_id_fkey(first_name, last_name, email)), owner:profiles!projects_owner_profile_id_fkey(first_name, last_name, email)";
const PROJECT_SELECT_COLUMNS_LEGACY = "id, organization_id, name, code, status, health, owner_profile_id, activated_at, target_date, completed_at, summary, created_at, updated_at, organizations(name, primary_contact:profiles!organizations_primary_contact_id_fkey(first_name, last_name, email)), owner:profiles!projects_owner_profile_id_fkey(first_name, last_name, email)";

function createProjectsServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
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

async function getOrganizationPrimaryContactId(supabase: SupabaseClient, organizationId: string): Promise<string | null> {
  const { data: organization, error } = await supabase
    .from("organizations")
    .select("primary_contact_id")
    .eq("id", organizationId)
    .maybeSingle<{ primary_contact_id: string | null }>();

  if (error) throw new Error(error.message);
  return typeof organization?.primary_contact_id === "string" ? organization.primary_contact_id : null;
}

type OrganizationMemberRole = "admin" | "member";

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

async function listOrganizationMemberProfiles(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<Array<{
  profile_id: string;
  role: OrganizationMemberRole;
  profile: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
}>> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("profile_id, role, profile:profiles!organization_members_profile_id_fkey(first_name, last_name, email)")
    .eq("organization_id", organizationId);

  if (error) throw new Error(error.message);

  return (data ?? []).flatMap((row) => {
    const profileId = typeof row.profile_id === "string" ? row.profile_id : "";
    const role = row.role === "admin" || row.role === "member" ? row.role : null;
    if (!profileId || !role) return [];

    const profileRaw = row.profile;
    const profile = Array.isArray(profileRaw) ? profileRaw[0] ?? null : profileRaw ?? null;

    return [{
      profile_id: profileId,
      role,
      profile: profile
        ? {
          first_name: typeof profile.first_name === "string" ? profile.first_name : null,
          last_name: typeof profile.last_name === "string" ? profile.last_name : null,
          email: typeof profile.email === "string" ? profile.email : null,
        }
        : null,
    }];
  });
}

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

function buildProfileDisplayName(profile: { first_name: string | null; last_name: string | null; email?: string | null }) {
  const full = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  if (full) return full;
  return typeof profile.email === "string" && profile.email.trim().length > 0 ? profile.email : null;
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
    status: String(row.status) as ProjectListItem["status"],
    health: String(row.health) as ProjectListItem["health"],
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
      query = query
        .lt("target_date", new Date().toISOString().slice(0, 10))
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
        .lt("target_date", new Date().toISOString().slice(0, 10))
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

    const [{ data: taskRows }, { data: milestoneRows }] = await Promise.all([
      supabase
        .from("project_tasks")
        .select("project_id, status, due_date")
        .in("project_id", ids),
      supabase
        .from("project_milestones")
        .select("project_id, status")
        .in("project_id", ids),
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

export async function listOrgAdminProjectsByProfile(
  supabase: SupabaseClient,
  profileId: string,
  options?: { limit?: number },
): Promise<ProjectListItem[]> {
  const limit = typeof options?.limit === "number" && options.limit > 0 ? options.limit : 20;
  const { data: internalAssignments, error: internalAssignmentsError } = await supabase
    .from("user_role_assignments")
    .select("role_code")
    .eq("profile_id", profileId)
    .eq("role_code", "admin");

  if (internalAssignmentsError) throw new Error(internalAssignmentsError.message);
  const isBegreenAdmin = (internalAssignments ?? []).some((row) => row.role_code === "admin");

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

    const [{ data: taskRows }, { data: milestoneRows }] = await Promise.all([
      supabase
        .from("project_tasks")
        .select("project_id, status, due_date")
        .in("project_id", ids),
      supabase
        .from("project_milestones")
        .select("project_id, status")
        .in("project_id", ids),
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
      "id, project_id, milestone_id, title, description, status, priority, assignee_profile_id, reporter_profile_id, due_date, position, blocked_reason, created_at, updated_at, assignee:profiles!project_tasks_assignee_profile_id_fkey(first_name, last_name, email), reporter:profiles!project_tasks_reporter_profile_id_fkey(first_name, last_name, email)",
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
    .select("id, project_id, title, status, target_date, completed_at, position, created_at, updated_at")
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

async function listProjectMembers(supabase: SupabaseClient, projectId: string): Promise<ProjectDashboardData["members"]> {
  const { data, error } = await supabase
    .from("project_members")
    .select(
      "id, project_id, profile_id, role, created_at, profile:profiles!project_members_profile_id_fkey(first_name, last_name, email)",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return normalizeMemberRows(data ?? []);
}

export async function getProjectDashboard(supabase: SupabaseClient, projectId: string): Promise<ProjectDashboardData> {
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

  const [tasks, milestones, links, members, projectActivity, relatedActivity] = await Promise.all([
    listProjectTasks(supabase, projectId),
    listProjectMilestones(supabase, projectId),
    listProjectLinks(supabase, projectId),
    listProjectMembers(supabase, projectId),
    supabase
      .from("app_activity_events")
      .select("id, created_at, event_type, summary, payload, actor_profile_id")
      .eq("domain", "projects")
      .eq("entity_table", "projects")
      .eq("entity_id", projectId)
      .order("created_at", { ascending: false }),
    supabase
      .from("app_activity_events")
      .select("id, created_at, event_type, summary, payload, actor_profile_id")
      .eq("domain", "projects")
      .filter("payload->>project_id", "eq", projectId)
      .neq("entity_table", "projects")
      .order("created_at", { ascending: false }),
  ]);

  if (projectActivity.error) throw new Error(projectActivity.error.message);
  if (relatedActivity.error) throw new Error(relatedActivity.error.message);

  const projectRecord = toRecord(data);
  if (!projectRecord) throw new Error("Projeto não encontrado.");
  const project = normalizeProjectRow(projectRecord);
  project.taskStats.total = tasks.length;
  project.taskStats.done = tasks.filter((task) => task.status === "done").length;
  project.taskStats.blocked = tasks.filter((task) => task.status === "blocked").length;
  const today = new Date().toISOString().slice(0, 10);
  project.taskStats.overdue = tasks.filter((task) => task.dueDate && task.dueDate < today && task.status !== "done").length;
  project.milestoneStats.total = milestones.length;
  project.milestoneStats.achieved = milestones.filter((m) => m.status === "achieved").length;
  project.milestoneStats.delayed = milestones.filter((m) => m.status === "delayed").length;
  project.health = deriveProjectHealth(project);
  const allActivityRows = [...(projectActivity.data ?? []), ...(relatedActivity.data ?? [])]
    .toSorted((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const actorProfileIds = Array.from(
    new Set(
      allActivityRows
        .map((row) => (typeof row.actor_profile_id === "string" ? row.actor_profile_id : ""))
        .filter(Boolean),
    ),
  );
  const actorLabelsById = new Map<string, string>();
  if (actorProfileIds.length > 0) {
    const { data: actorProfiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", actorProfileIds);
    for (const profile of actorProfiles ?? []) {
      if (typeof profile.id !== "string") continue;
      const label = buildProfileDisplayName({
        first_name: typeof profile.first_name === "string" ? profile.first_name : null,
        last_name: typeof profile.last_name === "string" ? profile.last_name : null,
        email: typeof profile.email === "string" ? profile.email : null,
      });
      if (label) actorLabelsById.set(profile.id, label);
    }
  }

  return {
    project,
    members,
    milestones,
    tasks,
    links,
    activity: allActivityRows.map((row) => ({
      id: String(row.id),
      createdAt: String(row.created_at),
      eventType: String(row.event_type),
      actorProfileId: typeof row.actor_profile_id === "string" ? row.actor_profile_id : null,
      actorLabel:
        typeof row.actor_profile_id === "string"
          ? (actorLabelsById.get(row.actor_profile_id) ?? null)
          : null,
      summary: String(row.summary),
      payload: (row.payload ?? {}) as Record<string, unknown>,
    })),
  };
}

export async function createProject(supabase: SupabaseClient, input: CreateProjectInput) {
  const cancellationReason = input.cancellationReason?.trim() || null;
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

  if (input.status === "canceled" && !cancellationReason) {
    throw new Error("Indica o motivo do cancelamento.");
  }

  if (typeof input.name === "string") payload.name = input.name.trim();
  if (typeof input.code !== "undefined") payload.code = input.code?.trim() || null;
  if (typeof input.status !== "undefined") payload.status = input.status;
  if (typeof input.ownerProfileId !== "undefined") payload.owner_profile_id = input.ownerProfileId || null;
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
    .select("id, name, organization_id")
    .eq("id", projectId)
    .maybeSingle<{ id: string; name: string; organization_id: string | null }>();

  if (projectError) throw new Error(projectError.message);
  if (!project?.id) throw new Error("Projeto não encontrado.");

  const { error: deleteError } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId);

  if (deleteError) throw new Error(deleteError.message);

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
    },
  });
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
  const payload = {
    project_id: projectId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    milestone_id: input.milestoneId ?? null,
    status,
    priority: input.priority ?? "medium",
    assignee_profile_id: input.assigneeProfileId ?? null,
    reporter_profile_id: input.reporterProfileId ?? null,
    due_date: input.dueDate ?? null,
    blocked_reason: status === "blocked" ? blockedReason : null,
    position,
  };

  const { error } = await supabase.from("project_tasks").insert(payload);
  if (error) throw new Error(error.message);
  await syncProjectHealth(supabase, projectId);
  return listProjectTasks(supabase, projectId);
}

export async function updateProjectTask(
  supabase: SupabaseClient,
  projectId: string,
  taskId: string,
  input: UpdateProjectTaskInput,
) {
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
  const { error } = await supabase
    .from("project_milestones")
    .delete()
    .eq("id", milestoneId)
    .eq("project_id", projectId);

  if (error) throw new Error(error.message);
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
  const { error } = await supabase
    .from("project_tasks")
    .delete()
    .eq("id", taskId)
    .eq("project_id", projectId);

  if (error) throw new Error(error.message);
  await syncProjectHealth(supabase, projectId);
  return listProjectTasks(supabase, projectId);
}

export async function deleteProjectLink(supabase: SupabaseClient, projectId: string, linkId: string) {
  const { error } = await supabase
    .from("project_links")
    .delete()
    .eq("id", linkId)
    .eq("project_id", projectId);

  if (error) throw new Error(error.message);
  return listProjectLinks(supabase, projectId);
}

export async function getClientProjectHealth(supabase: SupabaseClient, projectId: string) {
  const data = await getProjectDashboard(supabase, projectId);
  return {
    project: data.project,
    members: data.members,
    milestones: data.milestones,
    links: data.links.filter((link) => link.visibility === "client"),
    taskStats: data.project.taskStats,
    nextMilestone:
      data.milestones
        .filter((milestone) => milestone.status !== "achieved")
        .toSorted((a, b) => (a.targetDate ?? "9999-12-31").localeCompare(b.targetDate ?? "9999-12-31"))[0] ?? null,
  };
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

  const [
    { data: roleAssignments, error: roleAssignmentsError },
    organizationMembers,
    projectMembers,
  ] = await Promise.all([
    supabase
      .from("user_role_assignments")
      .select(
        "profile_id, role_code, profile:profiles!user_role_assignments_profile_id_fkey(first_name, last_name, email)",
      )
      .in("role_code", ["staff", "admin"])
      .order("assigned_at", { ascending: false }),
    listOrganizationMemberProfiles(supabase, project.organization_id),
    listProjectMembers(supabase, projectId),
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

  const orgOptions: ProjectAssignableProfile[] = (organizationMembers ?? []).flatMap((row) => {
    const roleCode: ProjectAssignableProfile["organizationRole"] =
      row.role === "admin" ? "org_admin" : "org_member";

    return [{
      profileId: row.profile_id,
      label: profileLabel(row.profile?.first_name, row.profile?.last_name, row.profile?.email) ?? "Membro",
      email: row.profile?.email ?? null,
      organizationRole: roleCode,
      projectRole: projectRoleByProfile.get(row.profile_id) ?? null,
    }];
  });

  const options = [...internalOptions, ...orgOptions];
  const uniqueByProfile = new Map<string, ProjectAssignableProfile>();
  for (const option of options) {
    if (!uniqueByProfile.has(option.profileId)) uniqueByProfile.set(option.profileId, option);
  }

  return Array.from(uniqueByProfile.values())
    .filter((item) => item.profileId.length > 0)
    .toSorted((a, b) => a.label.localeCompare(b.label, "pt-PT"));
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

  const [{ data: internalRoles, error: internalRolesError }, orgMembers] = await Promise.all([
    supabase
      .from("user_role_assignments")
      .select("profile_id, role_code")
      .in("role_code", ["staff", "admin"]),
    listOrganizationMemberProfiles(supabase, project.organization_id),
  ]);

  if (internalRolesError) throw new Error(internalRolesError.message);
  const organizationLeaderProfileId = await getOrganizationPrimaryContactId(supabase, project.organization_id);

  const allowedProfileIds = new Set(
    [
      ...(internalRoles ?? [])
        .map((row) => (typeof row.profile_id === "string" ? row.profile_id : ""))
        .filter(Boolean),
      ...(orgMembers ?? [])
        .map((row) => row.profile_id)
        .filter(Boolean),
    ],
  );

  const membersToPersist = input
    .filter((item) => allowedProfileIds.has(item.profileId))
    .map((item) => ({
      project_id: projectId,
      profile_id: item.profileId,
      role: item.role,
    }));
  const membersByProfile = new Map(membersToPersist.map((member) => [member.profile_id, member]));
  if (organizationLeaderProfileId) {
    membersByProfile.set(organizationLeaderProfileId, {
      project_id: projectId,
      profile_id: organizationLeaderProfileId,
      role: "observer",
    });
  }
  const finalMembersToPersist = Array.from(membersByProfile.values());
  const selectedOwnerProfileId = finalMembersToPersist.find((member) => member.role === "owner")?.profile_id ?? null;
  const ownerNeedsUpdate = (project.owner_profile_id ?? null) !== selectedOwnerProfileId;
  const { data: existingMembers, error: existingMembersError } = await supabase
    .from("project_members")
    .select("profile_id, role")
    .eq("project_id", projectId);

  if (existingMembersError) throw new Error(existingMembersError.message);

  const existingByProfile = new Map(
    (existingMembers ?? [])
      .map((member) => {
        const profileId = typeof member.profile_id === "string" ? member.profile_id : "";
        const role = typeof member.role === "string" ? member.role : "";
        return [profileId, role] as const;
      })
      .filter(([profileId]) => profileId.length > 0),
  );
  const nextByProfile = new Map(
    finalMembersToPersist.map((member) => [member.profile_id, member.role] as const),
  );
  const membersAreUnchanged =
    existingByProfile.size === nextByProfile.size
    && Array.from(nextByProfile.entries()).every(([profileId, role]) => existingByProfile.get(profileId) === role);

  if (membersAreUnchanged && !ownerNeedsUpdate) {
    return listProjectMembers(supabase, projectId);
  }

  const { error: clearError } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId);

  if (clearError) throw new Error(clearError.message);

  if (finalMembersToPersist.length > 0) {
    const { error: insertError } = await supabase
      .from("project_members")
      .insert(finalMembersToPersist);
    if (insertError) throw new Error(insertError.message);
  }

  if (ownerNeedsUpdate) {
    const { error: ownerUpdateError } = await supabase
      .from("projects")
      .update({ owner_profile_id: selectedOwnerProfileId })
      .eq("id", projectId);
    if (ownerUpdateError) throw new Error(ownerUpdateError.message);
  }

  return listProjectMembers(supabase, projectId);
}
