import type { SupabaseClient } from "@supabase/supabase-js";

export const PROJECT_STATUSES = ["planned", "active", "paused", "blocked", "completed", "canceled"] as const;
export const PROJECT_HEALTH_STATES = ["on_track", "at_risk", "off_track"] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ProjectHealth = (typeof PROJECT_HEALTH_STATES)[number];
export type ProjectsDueWindow = "all" | "overdue" | "next_7_days" | "next_30_days";

export type ProjectClientAccessSummary = {
  mode: "hidden" | "all_org_clients" | "selected_clients";
  organizationNames: string[];
  organizationCount: number;
  selectedClientCount: number;
  contentReadiness: {
    hasSummary: boolean;
    hasScope: boolean;
    hasContact: boolean;
    clientVisibleMilestoneCount: number;
    sharedDocumentCount: number;
  };
};

export type ProjectListItem = {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationOwnerLabel: string | null;
  organizationOwnerEmail: string | null;
  organizationOwnerPhone: string | null;
  participatingOrganizations?: Array<{ id: string; name: string; isPrimary: boolean }>;
  clientAccessSummary?: ProjectClientAccessSummary;
  name: string;
  code: string | null;
  status: ProjectStatus;
  health: ProjectHealth;
  ownerProfileId: string | null;
  ownerLabel: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  activatedAt: string | null;
  startDate: string | null;
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
  status?: ProjectStatus | "all" | null;
  health?: ProjectHealth | null;
  organizationId?: string | null;
  ownerProfileId?: string | null;
  dueWindow?: ProjectsDueWindow;
  dashboardAttention?: {
    dueThrough: string;
    includeProjectIds?: string[];
  };
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

export type ProjectsListTiming = {
  phase: "query" | "enrichment";
  durationMs: number;
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

const PROJECT_PROFILE_SELECT_COLUMNS = "first_name, last_name, email, phone";
const PROJECT_PROFILE_SELECT_COLUMNS_NO_PHONE = "first_name, last_name, email";

function buildProjectSelectColumns(profileColumns: string, includeCancellationReason: boolean) {
  const columns = [
    "id",
    "organization_id",
    "name",
    "code",
    "status",
    "health",
    "owner_profile_id",
    "activated_at",
    "start_date",
    "target_date",
    "completed_at",
    ...(includeCancellationReason ? ["cancellation_reason"] : []),
    "summary",
    "created_at",
    "updated_at",
  ];

  return `${columns.join(", ")}, organizations(name, primary_contact:profiles!organizations_primary_contact_id_fkey(${profileColumns})), owner:profiles!projects_owner_profile_id_fkey(${profileColumns})`;
}

const PROJECT_SELECT_COLUMNS = buildProjectSelectColumns(PROJECT_PROFILE_SELECT_COLUMNS, true);
const PROJECT_SELECT_COLUMNS_LEGACY = buildProjectSelectColumns(PROJECT_PROFILE_SELECT_COLUMNS, false);
const PROJECT_SELECT_COLUMNS_NO_PHONE = buildProjectSelectColumns(PROJECT_PROFILE_SELECT_COLUMNS_NO_PHONE, true);
const PROJECT_SELECT_COLUMNS_LEGACY_NO_PHONE = buildProjectSelectColumns(PROJECT_PROFILE_SELECT_COLUMNS_NO_PHONE, false);

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.toLowerCase();
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message.toLowerCase();
  }
  return String(error).toLowerCase();
}

export function isProjectsSchemaMissingError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return (
    message.includes("could not find the table 'public.projects' in the schema cache")
    || message.includes("relation \"projects\" does not exist")
    || message.includes("relation \"public.projects\" does not exist")
    || message.includes("relation \"project_tasks\" does not exist")
    || message.includes("relation \"public.project_tasks\" does not exist")
    || isProjectTaskStatsMissingError(error)
    || message.includes("column projects.cancellation_reason does not exist")
  );
}

function isProjectTaskStatsMissingError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return (
    message.includes("could not find the table 'public.project_task_stats' in the schema cache")
    || message.includes("relation \"project_task_stats\" does not exist")
    || message.includes("relation \"public.project_task_stats\" does not exist")
  );
}

function isMissingProjectCancellationReasonColumnError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return (
    message.includes("column projects.cancellation_reason does not exist")
    || message.includes("column \"cancellation_reason\" does not exist")
  );
}

function isMissingProfilesPhoneColumnError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return (
    message.includes("column profiles.phone does not exist")
    || message.includes("column profiles_2.phone does not exist")
    || message.includes("column \"phone\" does not exist")
  );
}

function nextProjectsSelectColumnsForRecoverableError(currentColumns: string, error: unknown): string | null {
  if (isMissingProjectCancellationReasonColumnError(error)) {
    if (currentColumns === PROJECT_SELECT_COLUMNS) return PROJECT_SELECT_COLUMNS_LEGACY;
    if (currentColumns === PROJECT_SELECT_COLUMNS_NO_PHONE) return PROJECT_SELECT_COLUMNS_LEGACY_NO_PHONE;
  }

  if (isMissingProfilesPhoneColumnError(error)) {
    if (currentColumns === PROJECT_SELECT_COLUMNS) return PROJECT_SELECT_COLUMNS_NO_PHONE;
    if (currentColumns === PROJECT_SELECT_COLUMNS_LEGACY) return PROJECT_SELECT_COLUMNS_LEGACY_NO_PHONE;
  }

  return null;
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

const ENRICHMENT_PAGE_SIZE = 1000;

// Supabase/PostgREST caps unbounded selects at 1000 rows, which silently truncates
// task/milestone enrichment for task-heavy portfolios. Page explicitly until a short
// page signals the end. Long-term alternative (deferred): a grouped-count RPC so the
// database aggregates per project instead of shipping every row.
export async function fetchAllRows<TRow>(
  runPageQuery: (from: number, to: number) => PromiseLike<{ data: TRow[] | null; error: { message: string } | null }>,
): Promise<{ data: TRow[]; error: { message: string } | null }> {
  const rows: TRow[] = [];
  for (let offset = 0; ; offset += ENRICHMENT_PAGE_SIZE) {
    const { data, error } = await runPageQuery(offset, offset + ENRICHMENT_PAGE_SIZE - 1);
    if (error) return { data: rows, error };
    const page = data ?? [];
    rows.push(...page);
    if (page.length < ENRICHMENT_PAGE_SIZE) break;
  }
  return { data: rows, error: null };
}

type ProjectTaskStatsRow = {
  project_id: string;
  total: number | string;
  done: number | string;
  overdue: number | string;
  blocked: number | string;
};

export async function getProjectTaskStats(
  supabase: SupabaseClient,
  projectIds: string[],
): Promise<Map<string, ProjectListItem["taskStats"]>> {
  if (projectIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("project_task_stats")
    .select("project_id,total,done,overdue,blocked")
    .in("project_id", projectIds);
  if (error && !isProjectTaskStatsMissingError(error)) throw new Error(error.message);
  if (error) {
    const { data: taskRows, error: taskRowsError } = await fetchAllRows((from, to) =>
      supabase
        .from("project_tasks")
        .select("id,project_id,status,due_date")
        .in("project_id", projectIds)
        .order("id", { ascending: true })
        .range(from, to),
    );
    if (taskRowsError) throw new Error(taskRowsError.message);

    const today = new Date().toISOString().slice(0, 10);
    const fallback = new Map<string, ProjectListItem["taskStats"]>();
    for (const row of taskRows ?? []) {
      const projectId = typeof row.project_id === "string" ? row.project_id : "";
      if (!projectId) continue;
      const current = fallback.get(projectId) ?? { total: 0, done: 0, overdue: 0, blocked: 0 };
      current.total += 1;
      if (row.status === "done") current.done += 1;
      if (row.status === "blocked") current.blocked += 1;
      if (row.status !== "done" && typeof row.due_date === "string" && row.due_date < today) current.overdue += 1;
      fallback.set(projectId, current);
    }
    return fallback;
  }
  return new Map(((data ?? []) as ProjectTaskStatsRow[]).map((row) => [
    row.project_id,
    {
      total: Number(row.total),
      done: Number(row.done),
      overdue: Number(row.overdue),
      blocked: Number(row.blocked),
    },
  ]));
}

export async function listProjects(
  supabase: SupabaseClient,
  params: ListProjectsParams,
  options: { onTiming?: (metric: ProjectsListTiming) => void } = {},
): Promise<ProjectsListResult> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const today = new Date();
  const todayDate = today.toISOString().slice(0, 10);

  const runProjectsListQuery = (columns: string) => {
    let query = supabase
      .from("projects")
      .select(columns, { count: "exact" });

    query = params.dashboardAttention
      ? query.order("target_date", { ascending: true, nullsFirst: false })
      : query.order("updated_at", { ascending: false });
    query = query.range(from, to);

    if (params.status === undefined || params.status === null) {
      query = query.not("status", "in", "(completed,canceled)");
    } else if (params.status !== "all") {
      query = query.eq("status", params.status);
    }
    if (params.health === "at_risk") {
      query = query.or("health.eq.at_risk,status.eq.blocked");
    } else if (params.health === "off_track") {
      query = query.lt("target_date", todayDate).not("status", "in", "(completed,canceled)");
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
      query = query.lt("target_date", todayDate).not("status", "in", "(completed,canceled)");
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

    if (params.dashboardAttention) {
      const includeProjectIds = (params.dashboardAttention.includeProjectIds ?? [])
        .filter((id) => /^[0-9a-f-]{36}$/i.test(id));
      const attentionFilters = [
        `target_date.lte.${params.dashboardAttention.dueThrough}`,
        "health.in.(at_risk,off_track)",
        "status.eq.blocked",
        "owner_profile_id.is.null",
      ];
      if (includeProjectIds.length > 0) attentionFilters.push(`id.in.(${includeProjectIds.join(",")})`);
      query = query.or(attentionFilters.join(","));
    }

    return query;
  };

  const queryStartedAt = performance.now();
  let columns = PROJECT_SELECT_COLUMNS;
  const attemptedColumns = new Set<string>();
  let { data, error, count } = await runProjectsListQuery(columns);

  while (error) {
    const nextColumns = nextProjectsSelectColumnsForRecoverableError(columns, error);
    if (!nextColumns || attemptedColumns.has(nextColumns)) break;
    attemptedColumns.add(columns);
    columns = nextColumns;
    ({ data, error, count } = await runProjectsListQuery(columns));
  }

  if (error) throw new Error(error.message);
  options.onTiming?.({ phase: "query", durationMs: Math.max(0, performance.now() - queryStartedAt) });

  const items = mapRows(data, normalizeProjectRow);
  const enrichmentStartedAt = performance.now();
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
  options.onTiming?.({ phase: "enrichment", durationMs: Math.max(0, performance.now() - enrichmentStartedAt) });

  return {
    items,
    total: count ?? 0,
    page,
    pageSize,
  };
}
