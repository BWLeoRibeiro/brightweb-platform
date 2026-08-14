import type { SupabaseClient } from "@supabase/supabase-js";
import {
  publicError,
  sanitizePublicError,
} from "@brightweblabs/infra/robustness";
import { appendServerTiming, elapsedMs, requestStartedAt } from "@brightweblabs/infra/request-observability";
import {
  isMilestoneStatus,
  isProjectHealth,
  isProjectClientAccessMode,
  isProjectLinkKind,
  isProjectLinkVisibility,
  isProjectMemberRole,
  isProjectStatus,
  isProjectMilestoneVisibility,
  isTaskPriority,
  isTaskStatus,
  parsePositiveInt,
} from "./contracts";
import {
  createProjectWithAccess,
  getClientProject,
  getProjectClientAccess,
  listClientOrganizations,
  listClientProjects,
  listProjectSetupOptions,
  updateProjectClientAccess,
  updateProjectOrganizations,
} from "./client-access";
import {
  getProjectPortfolioStats,
  listProjects,
  type ListProjectsParams,
  type ProjectsDueWindow,
} from "./data";
import {
  getProjectsDashboardData,
  getTasksDashboardData,
} from "./dashboard";
import {
  createProject,
  createProjectLink,
  createProjectMilestone,
  createProjectOrganization,
  createProjectTask,
  deleteProject,
  deleteProjectLink,
  deleteProjectMilestone,
  deleteProjectTask,
  getProjectDashboard,
  getProjectAccess,
  listProjectActivity,
  queryProjectActivity,
  listProjectAssignableProfiles,
  syncProjectMembers,
  updateProject,
  updateProjectLink,
  updateProjectMilestone,
  updateProjectTask,
} from "./server";
import type {
  CreateProjectInput,
  CreateProjectLinkInput,
  CreateProjectMilestoneInput,
  CreateProjectOrganizationInput,
  CreateProjectTaskInput,
  ProjectMemberInput,
  UpdateProjectInput,
  UpdateProjectLinkInput,
  UpdateProjectMilestoneInput,
  UpdateProjectTaskInput,
} from "./types";
import type {
  CreateProjectWithAccessInput,
  UpdateProjectClientAccessInput,
} from "./client-contracts";
import { hasSelectedClientOrganizationWithoutAudience } from "./client-access-validation";

export function json(body: unknown, init?: ResponseInit) {
  const payload = JSON.stringify(body);
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("content-length", String(new TextEncoder().encode(payload).byteLength));
  return new Response(payload, {
    ...init,
    headers,
  });
}

type ServerUserAccess =
  | {
    ok: true;
    supabase: unknown;
    profileId?: string;
    role?: string | null;
  }
  | {
    ok: false;
    status: number;
    error: string;
  };

type ProjectsRequestContext = {
  params: Promise<{ id: string; itemId?: string }>;
};

export type ProjectsHttpDependencies = {
  getAccess: () => Promise<ServerUserAccess>;
  listProjects: typeof listProjects;
  getPortfolioStats: typeof getProjectPortfolioStats;
  getProjectsDashboardData: typeof getProjectsDashboardData;
  getTasksDashboardData: typeof getTasksDashboardData;
  getDashboard: typeof getProjectDashboard;
  listActivity: typeof listProjectActivity;
  queryActivity: typeof queryProjectActivity;
  listAssignableProfiles: typeof listProjectAssignableProfiles;
  createOrganization: typeof createProjectOrganization;
  createProject: typeof createProject;
  updateProject: typeof updateProject;
  deleteProject: typeof deleteProject;
  syncMembers: typeof syncProjectMembers;
  createMilestone: typeof createProjectMilestone;
  updateMilestone: typeof updateProjectMilestone;
  deleteMilestone: typeof deleteProjectMilestone;
  createTask: typeof createProjectTask;
  updateTask: typeof updateProjectTask;
  deleteTask: typeof deleteProjectTask;
  createLink: typeof createProjectLink;
  updateLink: typeof updateProjectLink;
  deleteLink: typeof deleteProjectLink;
  listClientProjects: typeof listClientProjects;
  listClientOrganizations: typeof listClientOrganizations;
  getClientProject: typeof getClientProject;
  getProjectClientAccess: typeof getProjectClientAccess;
  updateProjectClientAccess: typeof updateProjectClientAccess;
  updateProjectOrganizations: typeof updateProjectOrganizations;
  listProjectSetupOptions: typeof listProjectSetupOptions;
  createProjectWithAccess: typeof createProjectWithAccess;
  getProjectAccess: typeof getProjectAccess;
};

const PROJECT_DUE_WINDOWS = ["all", "overdue", "next_7_days", "next_30_days"] as const;

function isProjectsDueWindow(value: unknown): value is ProjectsDueWindow {
  return typeof value === "string" && PROJECT_DUE_WINDOWS.some((item) => item === value);
}

export function parseProjectsListRequest(request: Request | URL | string): ListProjectsParams {
  const url = request instanceof URL ? request : new URL(typeof request === "string" ? request : request.url);
  const status = url.searchParams.get("status");
  const health = url.searchParams.get("health");
  const dueWindow = url.searchParams.get("dueWindow");

  return {
    page: parsePositiveInt(url.searchParams.get("page"), 1, 10_000),
    pageSize: parsePositiveInt(url.searchParams.get("pageSize"), 20, 100),
    search: url.searchParams.get("search")?.trim() ?? "",
    status: status === "all" ? "all" : isProjectStatus(status) ? status : undefined,
    health: isProjectHealth(health) ? health : null,
    organizationId: url.searchParams.get("organizationId")?.trim() || null,
    ownerProfileId: url.searchParams.get("ownerProfileId")?.trim() || null,
    dueWindow: isProjectsDueWindow(dueWindow) ? dueWindow : "all",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

async function parseJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const payload = await request.json();
    return isRecord(payload) ? payload : null;
  } catch {
    return null;
  }
}

function invalidPayload(message = "Invalid JSON object payload.") {
  return json(publicError("INVALID_PAYLOAD", message), { status: 400 });
}

function requireStaffAccess(access: Extract<ServerUserAccess, { ok: true }>): Response | null {
  return access.role === "staff" || access.role === "admin"
    ? null
    : json(publicError("FORBIDDEN", "Forbidden."), { status: 403 });
}

const PROJECT_DOMAIN_ERRORS = {
  "Projeto não encontrado.": {
    code: "PROJECT_NOT_FOUND",
    message: "Projeto não encontrado.",
  },
  "Organização não encontrada.": {
    code: "ORGANIZATION_NOT_FOUND",
    message: "Organização não encontrada.",
  },
} as const;

function projectsErrorResponse(error: unknown, context: string, status = 500) {
  const message = error instanceof Error ? error.message : "";
  if (message === "The idempotency key was already used with another request.") {
    return json(publicError("IDEMPOTENCY_CONFLICT", message), { status: 409 });
  }
  if (
    message === "Only authenticated staff can create projects."
    || message === "Staff creators must own the projects they create."
    || message.startsWith("Only project owners or administrators can")
  ) {
    return json(publicError("FORBIDDEN", "Forbidden."), { status: 403 });
  }
  if (
    message === "Indica o motivo do cancelamento."
    || message === "Motivo de bloqueio é obrigatório quando a tarefa está bloqueada."
    || message === "name é obrigatório."
    || message === "A equipa interna só pode incluir administradores e membros de staff."
    || message === "Invalid project creation payload."
    || message === "Project name, primary organization, and status are invalid."
    || message === "The primary organization must participate in the project."
    || message === "One or more participating organizations do not exist."
    || message === "A data alvo não pode ser anterior à data de início."
    || message.startsWith("Exactly one internal project owner is required")
    || message === "Each internal profile can appear only once in the project team."
    || message === "Project members must be internal staff."
    || message === "The client contact must be an internal staff profile."
    || message === "The client contact must be an internal project team member."
    || message === "Every project member requires a valid profile and role."
    || message === "The responsible client contact must remain in the internal project team."
  ) {
    return json(publicError("INVALID_INPUT", message), { status: 400 });
  }

  const envelope = sanitizePublicError(
    error,
    PROJECT_DOMAIN_ERRORS,
    "Projects request could not be completed.",
    context,
  );
  const code = envelope.error.code;
  const resolvedStatus =
    code === "PROJECT_NOT_FOUND" || code === "ORGANIZATION_NOT_FOUND"
      ? 404
      : status;
  return json(envelope, { status: resolvedStatus });
}

type ProjectsAction = (
  access: Extract<ServerUserAccess, { ok: true }>,
  request: Request,
  context?: ProjectsRequestContext,
) => Promise<Response>;

type ProjectsActionWithoutContext = (
  access: Extract<ServerUserAccess, { ok: true }>,
  request: Request,
) => Promise<Response>;

function withUserAccess(
  dependencies: ProjectsHttpDependencies,
  errorContext: string,
  action: ProjectsAction,
) {
  return async (request: Request, context?: ProjectsRequestContext) => {
    const startedAt = requestStartedAt();
    const access = await dependencies.getAccess();
    if (!access.ok) {
      return appendServerTiming(json(publicError("ACCESS_DENIED", access.error), { status: access.status }), [
        { name: "app", durationMs: elapsedMs(startedAt) },
      ]);
    }

    try {
      const response = await action(access, request, context);
      return appendServerTiming(response, [{ name: "app", durationMs: elapsedMs(startedAt) }]);
    } catch (error) {
      return appendServerTiming(projectsErrorResponse(error, errorContext), [
        { name: "app", durationMs: elapsedMs(startedAt) },
      ]);
    }
  };
}

function withUserAccessWithoutContext(
  dependencies: ProjectsHttpDependencies,
  errorContext: string,
  action: ProjectsActionWithoutContext,
) {
  const handler = withUserAccess(
    dependencies,
    errorContext,
    (access, request) => action(access, request),
  );
  return (request: Request) => handler(request);
}

function withStaffAccess(
  dependencies: ProjectsHttpDependencies,
  errorContext: string,
  action: ProjectsAction,
) {
  return async (request: Request, context?: ProjectsRequestContext) => {
    const access = await dependencies.getAccess();
    if (!access.ok) {
      return json(publicError("ACCESS_DENIED", access.error), { status: access.status });
    }
    const forbidden = requireStaffAccess(access);
    if (forbidden) return forbidden;

    try {
      return await action(access, request, context);
    } catch (error) {
      return projectsErrorResponse(error, errorContext);
    }
  };
}

function withStaffAccessWithoutContext(
  dependencies: ProjectsHttpDependencies,
  errorContext: string,
  action: ProjectsActionWithoutContext,
) {
  const handler = withStaffAccess(
    dependencies,
    errorContext,
    (access, request) => action(access, request),
  );
  return (request: Request) => handler(request);
}

function requireClientAccess(access: Extract<ServerUserAccess, { ok: true }>): Response | null {
  return access.role === "client" && access.profileId
    ? null
    : json(publicError("FORBIDDEN", "Forbidden."), { status: 403 });
}

async function requireProjectClientAccessManager(
  dependencies: ProjectsHttpDependencies,
  access: Extract<ServerUserAccess, { ok: true }>,
  projectId: string,
): Promise<Response | null> {
  if (access.role === "admin") return null;
  if (access.role !== "staff" || !access.profileId) {
    return json(publicError("FORBIDDEN", "Forbidden."), { status: 403 });
  }
  const projectAccess = await dependencies.getProjectAccess(
    access.supabase as SupabaseClient,
    projectId,
    access.profileId,
    access.role,
  );
  return projectAccess.projectRole === "owner"
    ? null
    : json(publicError("FORBIDDEN", "Forbidden."), { status: 403 });
}

async function getRouteParams(context: ProjectsRequestContext | undefined) {
  if (!context) throw new Error("Missing Projects route context.");
  return context.params;
}

async function getItemRouteParams(context: ProjectsRequestContext | undefined) {
  const { id, itemId } = await getRouteParams(context);
  if (!itemId) throw new Error("Missing Projects item route parameter.");
  return { id, itemId };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function uniqueStrings(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every(isNonEmptyString)) return null;
  return Array.from(new Set(value));
}

type FieldValidator = (value: unknown) => boolean;

function invalidField(
  payload: Record<string, unknown>,
  validators: Record<string, FieldValidator>,
  requiredFields: readonly string[] = [],
) {
  for (const field of requiredFields) {
    if (!hasOwn(payload, field) || !validators[field]?.(payload[field])) return field;
  }
  for (const [field, validator] of Object.entries(validators)) {
    if (hasOwn(payload, field) && !validator(payload[field])) return field;
  }
  return null;
}

function pickInput<T>(payload: Record<string, unknown>, fields: readonly string[]): T {
  const input: Record<string, unknown> = {};
  for (const field of fields) {
    if (hasOwn(payload, field)) input[field] = payload[field];
  }
  return input as T;
}

function validateInput<T>(
  payload: Record<string, unknown>,
  fields: readonly string[],
  validators: Record<string, FieldValidator>,
  requiredFields: readonly string[] = [],
): T | Response {
  const field = invalidField(payload, validators, requiredFields);
  if (field) return invalidPayload(`Invalid "${field}" field.`);
  if (fields.every((key) => !hasOwn(payload, key))) {
    return json(publicError("EMPTY_UPDATE", "At least one field is required."), { status: 400 });
  }
  return pickInput<T>(payload, fields);
}

function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

const nullableString = isNullableString;
const projectFields = [
  "name",
  "code",
  "status",
  "ownerProfileId",
  "startDate",
  "targetDate",
  "cancellationReason",
  "summary",
] as const;
const projectUpdateFields = [
  "name",
  "code",
  "status",
  "startDate",
  "targetDate",
  "cancellationReason",
  "summary",
] as const;
const projectValidators: Record<(typeof projectFields)[number], FieldValidator> = {
  name: isNonEmptyString,
  code: nullableString,
  status: isProjectStatus,
  ownerProfileId: nullableString,
  startDate: nullableString,
  targetDate: nullableString,
  cancellationReason: nullableString,
  summary: nullableString,
};
const projectUpdateValidators: Record<(typeof projectUpdateFields)[number], FieldValidator> = {
  name: isNonEmptyString,
  code: nullableString,
  status: isProjectStatus,
  startDate: nullableString,
  targetDate: nullableString,
  cancellationReason: nullableString,
  summary: nullableString,
};

const organizationFields = [
  "name",
  "primaryContactId",
  "industry",
  "companySize",
  "budgetRange",
  "websiteUrl",
  "addressLine1",
  "addressLine2",
  "zipCode",
  "country",
  "taxIdentifierValue",
] as const;
const organizationValidators: Record<(typeof organizationFields)[number], FieldValidator> = {
  name: isNonEmptyString,
  primaryContactId: nullableString,
  industry: nullableString,
  companySize: nullableString,
  budgetRange: nullableString,
  websiteUrl: nullableString,
  addressLine1: nullableString,
  addressLine2: nullableString,
  zipCode: nullableString,
  country: nullableString,
  taxIdentifierValue: nullableString,
};

const taskFields = [
  "title",
  "description",
  "milestoneId",
  "status",
  "priority",
  "assigneeProfileId",
  "reporterProfileId",
  "startDate",
  "dueDate",
  "position",
  "blockedReason",
] as const;
const taskValidators: Record<(typeof taskFields)[number], FieldValidator> = {
  title: isNonEmptyString,
  description: nullableString,
  milestoneId: nullableString,
  status: isTaskStatus,
  priority: isTaskPriority,
  assigneeProfileId: nullableString,
  reporterProfileId: nullableString,
  startDate: nullableString,
  dueDate: nullableString,
  position: isFiniteNumber,
  blockedReason: nullableString,
};

const milestoneFields = ["title", "status", "targetDate", "completedAt", "position", "visibility"] as const;
const milestoneValidators: Record<(typeof milestoneFields)[number], FieldValidator> = {
  title: isNonEmptyString,
  status: isMilestoneStatus,
  targetDate: nullableString,
  completedAt: nullableString,
  position: isFiniteNumber,
  visibility: isProjectMilestoneVisibility,
};

const linkFields = ["label", "url", "visibility", "kind"] as const;
const linkValidators: Record<(typeof linkFields)[number], FieldValidator> = {
  label: isNonEmptyString,
  url: isNonEmptyString,
  visibility: isProjectLinkVisibility,
  kind: isProjectLinkKind,
};

function parseClientAccessInput(value: unknown): UpdateProjectClientAccessInput | Response {
  if (!isRecord(value) || !isProjectClientAccessMode(value.mode) || !Array.isArray(value.organizations)) {
    return invalidPayload('Invalid "clientAccess" field.');
  }
  const organizations: UpdateProjectClientAccessInput["organizations"] = [];
  const seenOrganizationIds = new Set<string>();
  for (const organization of value.organizations) {
    if (!isRecord(organization) || !isNonEmptyString(organization.organizationId)) {
      return invalidPayload('Invalid "clientAccess.organizations" field.');
    }
    const selectedProfileIds = uniqueStrings(organization.selectedProfileIds);
    if (!selectedProfileIds) {
      return invalidPayload('Invalid "selectedProfileIds" field.');
    }
    if (seenOrganizationIds.has(organization.organizationId)) {
      return invalidPayload("Each client access organization can appear only once.");
    }
    seenOrganizationIds.add(organization.organizationId);
    organizations.push({ organizationId: organization.organizationId, selectedProfileIds });
  }
  if (value.mode !== "hidden" && organizations.length === 0) {
    return invalidPayload("Visible client access requires at least one organization.");
  }
  if (value.mode === "hidden" && organizations.length > 0) {
    return invalidPayload("Hidden client access cannot include organizations.");
  }
  if (value.mode === "all_org_clients" && organizations.some((organization) => organization.selectedProfileIds.length > 0)) {
    return invalidPayload("Organization-wide access cannot include selected profiles.");
  }
  if (hasSelectedClientOrganizationWithoutAudience(value.mode, organizations)) {
    return invalidPayload("Every selected organization requires at least one selected client.");
  }
  for (const field of ["clientSummary", "clientScope", "clientContactProfileId"] as const) {
    if (hasOwn(value, field) && !isNullableString(value[field])) {
      return invalidPayload(`Invalid "${field}" field.`);
    }
  }
  return {
    mode: value.mode,
    organizations,
    ...(hasOwn(value, "clientSummary") ? { clientSummary: value.clientSummary as string | null } : {}),
    ...(hasOwn(value, "clientScope") ? { clientScope: value.clientScope as string | null } : {}),
    ...(hasOwn(value, "clientContactProfileId") ? { clientContactProfileId: value.clientContactProfileId as string | null } : {}),
  };
}

function parseAtomicCreateInput(payload: Record<string, unknown>): CreateProjectWithAccessInput | Response | null {
  if (!hasOwn(payload, "project") && !hasOwn(payload, "idempotencyKey")) return null;
  if (!isUuid(payload.idempotencyKey) || !isRecord(payload.project)) {
    return invalidPayload('Invalid atomic project creation payload.');
  }
  const project = payload.project;
  const fields = ["organizationId", ...projectFields] as const;
  const projectInput = validateInput<CreateProjectInput>(
    project,
    fields,
    { organizationId: isNonEmptyString, ...projectValidators },
    ["organizationId", "name"],
  );
  if (isResponse(projectInput)) return projectInput;
  const participatingOrganizationIds = uniqueStrings(payload.participatingOrganizationIds);
  if (!participatingOrganizationIds) {
    return invalidPayload('Invalid "participatingOrganizationIds" field.');
  }
  if (!Array.isArray(payload.members)) return invalidPayload('Invalid "members" field.');
  const members: CreateProjectWithAccessInput["members"] = [];
  const memberProfileIds = new Set<string>();
  for (const member of payload.members) {
    if (!isRecord(member) || !isNonEmptyString(member.profileId) || !isProjectMemberRole(member.role)) {
      return invalidPayload('Invalid "members" field.');
    }
    if (memberProfileIds.has(member.profileId)) {
      return invalidPayload("Each internal profile can appear only once in the project team.");
    }
    memberProfileIds.add(member.profileId);
    members.push({ profileId: member.profileId, role: member.role });
  }
  if (members.filter((member) => member.role === "owner").length !== 1) {
    return invalidPayload("Project creation requires exactly one owner.");
  }
  const clientAccess = parseClientAccessInput(payload.clientAccess);
  if (isResponse(clientAccess)) return clientAccess;
  const participantIds = new Set([projectInput.organizationId, ...participatingOrganizationIds]);
  if (clientAccess.organizations.some((organization) => !participantIds.has(organization.organizationId))) {
    return invalidPayload("Client access organizations must participate in the project.");
  }
  if (projectInput.startDate && projectInput.targetDate && projectInput.targetDate < projectInput.startDate) {
    return invalidPayload("A data alvo não pode ser anterior à data de início.");
  }
  if (projectInput.status === "canceled" && !projectInput.cancellationReason?.trim()) {
    return invalidPayload("Indica o motivo do cancelamento.");
  }
  const clientFields = [
    "clientSummary",
    "clientScope",
    "clientContactProfileId",
  ] as const;
  for (const field of clientFields) {
    if (hasOwn(project, field) && !isNullableString(project[field])) {
      return invalidPayload(`Invalid "project.${field}" field.`);
    }
  }
  return {
    idempotencyKey: payload.idempotencyKey,
    project: {
      ...projectInput,
      ...(hasOwn(project, "clientSummary") ? { clientSummary: project.clientSummary as string | null } : {}),
      ...(hasOwn(project, "clientScope") ? { clientScope: project.clientScope as string | null } : {}),
      ...(hasOwn(project, "clientContactProfileId")
        ? { clientContactProfileId: project.clientContactProfileId as string | null }
        : {}),
    },
    participatingOrganizationIds,
    members,
    clientAccess,
  };
}

export function createProjectsGetHandler(dependencies: ProjectsHttpDependencies) {
  return withStaffAccess(dependencies, "projects.list", async (access, request) => {
    const timings = new Map<string, number>();
    const result = await dependencies.listProjects(
      access.supabase as never,
      parseProjectsListRequest(request),
      { onTiming: (metric) => timings.set(metric.phase, metric.durationMs) },
    );
    return appendServerTiming(json(result), [
      { name: "db", durationMs: timings.get("query") ?? 0 },
      { name: "enrich", durationMs: timings.get("enrichment") ?? 0 },
    ]);
  });
}

export function createProjectsStatsGetHandler(dependencies: ProjectsHttpDependencies) {
  return withStaffAccess(dependencies, "projects.stats", async (access) => {
    return json(await dependencies.getPortfolioStats(access.supabase as never));
  });
}

export function createProjectsDashboardOverviewGetHandler(dependencies: ProjectsHttpDependencies) {
  return withStaffAccessWithoutContext(dependencies, "projects.dashboard-overview", async (access) => {
    return json({ data: await dependencies.getProjectsDashboardData(access.supabase as never) });
  });
}

export function createTasksDashboardGetHandler(dependencies: ProjectsHttpDependencies) {
  return withStaffAccessWithoutContext(dependencies, "projects.tasks-dashboard", async (access, request) => {
    const url = new URL(request.url);
    return json({
      data: await dependencies.getTasksDashboardData(
        access.supabase as never,
        access.profileId,
        new Date(),
        {
          page: parsePositiveInt(url.searchParams.get("page"), 1, 10_000),
          pageSize: parsePositiveInt(url.searchParams.get("pageSize"), 50, 100),
        },
      ),
    });
  });
}

export function createProjectsDashboardGetHandler(dependencies: ProjectsHttpDependencies) {
  return withStaffAccess(dependencies, "projects.dashboard", async (access, _request, context) => {
    const { id } = await getRouteParams(context);
    return json(await dependencies.getDashboard(access.supabase as never, id));
  });
}

export function createProjectsActivityGetHandler(dependencies: ProjectsHttpDependencies) {
  return withStaffAccess(dependencies, "projects.activity", async (access, request, context) => {
    const { id } = await getRouteParams(context);
    const url = new URL(request.url);
    if (url.searchParams.has("page") || url.searchParams.has("pageSize")) {
      return json(await dependencies.queryActivity(access.supabase as never, id, {
        page: parsePositiveInt(url.searchParams.get("page"), 1, 10_000),
        pageSize: parsePositiveInt(url.searchParams.get("pageSize"), 50, 100),
      }));
    }
    return json(await dependencies.listActivity(access.supabase as never, id));
  });
}

export function createProjectsOrganizationsGetHandler(dependencies: ProjectsHttpDependencies) {
  return withStaffAccess(dependencies, "projects.organizations.list", async (access) => {
    const { data, error } = await (access.supabase as SupabaseClient)
      .from("organizations")
      .select("id, name")
      .order("name", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    return json(
      ((data ?? []) as Array<{ id: string; name: string }>).map(({ id, name }) => ({ id, name })),
    );
  });
}

export function createClientProjectsGetHandler(dependencies: ProjectsHttpDependencies) {
  return withUserAccessWithoutContext(dependencies, "projects.client.list", async (access) => {
    const forbidden = requireClientAccess(access);
    if (forbidden) return forbidden;
    const [items, organizations] = await Promise.all([
      dependencies.listClientProjects(access.supabase as SupabaseClient),
      dependencies.listClientOrganizations(access.supabase as SupabaseClient),
    ]);
    const ongoingProjects = items.filter((project) => (
      !project.archivedAt
      && (project.status === "active" || project.status === "paused" || project.status === "blocked")
    ));
    const featuredProject = ongoingProjects.length === 1
      ? await dependencies.getClientProject(access.supabase as SupabaseClient, ongoingProjects[0]!.id)
      : null;
    return json({ items, organizations, featuredProject });
  });
}

export function createClientProjectDetailGetHandler(dependencies: ProjectsHttpDependencies) {
  return withUserAccess(dependencies, "projects.client.detail", async (access, _request, context) => {
    const forbidden = requireClientAccess(access);
    if (forbidden) return forbidden;
    const { id } = await getRouteParams(context);
    if (!isUuid(id)) {
      return json(publicError("PROJECT_NOT_FOUND", "Projeto não encontrado."), { status: 404 });
    }
    const project = await dependencies.getClientProject(access.supabase as SupabaseClient, id);
    return project
      ? json({ data: project })
      : json(publicError("PROJECT_NOT_FOUND", "Projeto não encontrado."), { status: 404 });
  });
}

export function createProjectClientAccessGetHandler(dependencies: ProjectsHttpDependencies) {
  return withStaffAccess(dependencies, "projects.client-access.get", async (access, _request, context) => {
    const { id } = await getRouteParams(context);
    const forbidden = await requireProjectClientAccessManager(dependencies, access, id);
    if (forbidden) return forbidden;
    return json({ data: await dependencies.getProjectClientAccess(access.supabase as SupabaseClient, id) });
  });
}

export function createProjectClientAccessPatchHandler(dependencies: ProjectsHttpDependencies) {
  return withStaffAccess(dependencies, "projects.client-access.update", async (access, request, context) => {
    const { id } = await getRouteParams(context);
    const forbidden = await requireProjectClientAccessManager(dependencies, access, id);
    if (forbidden) return forbidden;
    const payload = await parseJsonObject(request);
    if (!payload) return invalidPayload();
    const input = parseClientAccessInput(payload);
    if (isResponse(input)) return input;
    const data = await dependencies.updateProjectClientAccess(access.supabase as SupabaseClient, id, input);
    return json({ data });
  });
}

export function createProjectOrganizationsPatchHandler(dependencies: ProjectsHttpDependencies) {
  return withStaffAccess(dependencies, "projects.organizations.update", async (access, request, context) => {
    const { id } = await getRouteParams(context);
    const forbidden = await requireProjectClientAccessManager(dependencies, access, id);
    if (forbidden) return forbidden;
    const payload = await parseJsonObject(request);
    const organizationIds = payload ? uniqueStrings(payload.organizationIds) : null;
    if (!organizationIds || organizationIds.length === 0) {
      return invalidPayload('Invalid "organizationIds" field.');
    }
    return json({
      data: await dependencies.updateProjectOrganizations(
        access.supabase as SupabaseClient,
        id,
        organizationIds,
      ),
    });
  });
}

export function createProjectsSetupOptionsGetHandler(dependencies: ProjectsHttpDependencies) {
  return withStaffAccessWithoutContext(dependencies, "projects.setup-options", async (access, request) => {
    if (!access.profileId) return json(publicError("FORBIDDEN", "Forbidden."), { status: 403 });
    const raw = new URL(request.url).searchParams.get("organizationIds") ?? "";
    const organizationIds = Array.from(new Set(raw.split(",").map((item) => item.trim()).filter(Boolean)));
    if (organizationIds.length > 50 || organizationIds.some((item) => !isUuid(item))) {
      return invalidPayload('Invalid "organizationIds" query parameter.');
    }
    return json({
      data: await dependencies.listProjectSetupOptions(
        access.supabase as SupabaseClient,
        access.profileId,
        organizationIds,
      ),
    });
  });
}

export function createProjectsAssignableProfilesGetHandler(dependencies: ProjectsHttpDependencies) {
  return withStaffAccess(dependencies, "projects.members.list", async (access, _request, context) => {
    const { id } = await getRouteParams(context);
    return json(await dependencies.listAssignableProfiles(access.supabase as never, id));
  });
}

export function createProjectsOrganizationsPostHandler(dependencies: ProjectsHttpDependencies) {
  return withStaffAccess(dependencies, "projects.organizations.create", async (access, request) => {
    const payload = await parseJsonObject(request);
    if (!payload) return invalidPayload();
    const input = validateInput<CreateProjectOrganizationInput>(
      payload,
      organizationFields,
      organizationValidators,
      ["name"],
    );
    if (isResponse(input)) return input;
    const organization = await dependencies.createOrganization(access.supabase as never, input);
    return json({ data: organization }, { status: 201 });
  });
}

export function createProjectsPostHandler(dependencies: ProjectsHttpDependencies) {
  return withStaffAccess(dependencies, "projects.create", async (access, request) => {
    const payload = await parseJsonObject(request);
    if (!payload) return invalidPayload();
    const atomicInput = parseAtomicCreateInput(payload);
    if (atomicInput !== null) {
      if (isResponse(atomicInput)) return atomicInput;
      const result = await dependencies.createProjectWithAccess(access.supabase as SupabaseClient, atomicInput);
      const ownerProfileId = atomicInput.members.find((member) => member.role === "owner")?.profileId ?? null;
      return json({
        data: {
          id: result.projectId,
          name: atomicInput.project.name.trim(),
          ownerProfileId,
          created: result.created,
        },
      }, { status: result.created ? 201 : 200 });
    }
    const fields = ["organizationId", ...projectFields] as const;
    const input = validateInput<CreateProjectInput>(
      payload,
      fields,
      { organizationId: isNonEmptyString, ...projectValidators },
      ["organizationId", "name"],
    );
    if (isResponse(input)) return input;
    if (!access.profileId) return json(publicError("FORBIDDEN", "Forbidden."), { status: 403 });
    const ownerProfileId = input.ownerProfileId || access.profileId;
    const result = await dependencies.createProjectWithAccess(access.supabase as SupabaseClient, {
      idempotencyKey: crypto.randomUUID(),
      project: {
        organizationId: input.organizationId,
        name: input.name,
        code: input.code,
        status: input.status,
        startDate: input.startDate,
        targetDate: input.targetDate,
        cancellationReason: input.cancellationReason,
        summary: input.summary,
      },
      participatingOrganizationIds: [input.organizationId],
      members: [{ profileId: ownerProfileId, role: "owner" }],
      clientAccess: { mode: "hidden", organizations: [] },
    });
    return json({
      data: {
        id: result.projectId,
        name: input.name.trim(),
        ownerProfileId,
      },
    }, { status: result.created ? 201 : 200 });
  });
}

export function createProjectsPatchHandler(dependencies: ProjectsHttpDependencies) {
  return withStaffAccess(dependencies, "projects.update", async (access, request, context) => {
    const { id } = await getRouteParams(context);
    const payload = await parseJsonObject(request);
    if (!payload) return invalidPayload();
    const input = validateInput<UpdateProjectInput>(
      payload,
      projectUpdateFields,
      projectUpdateValidators,
    );
    if (isResponse(input)) return input;
    await dependencies.updateProject(access.supabase as never, id, input);
    const dashboard = await dependencies.getDashboard(access.supabase as never, id);
    return json({ data: dashboard });
  });
}

export function createProjectsDeleteHandler(dependencies: ProjectsHttpDependencies) {
  return withStaffAccess(dependencies, "projects.delete", async (access, _request, context) => {
    const { id } = await getRouteParams(context);
    await dependencies.deleteProject(
      access.supabase as never,
      id,
      access.profileId ?? null,
    );
    return json({ data: { deletedId: id } });
  });
}

export function createProjectsMembersPutHandler(dependencies: ProjectsHttpDependencies) {
  return withStaffAccess(dependencies, "projects.members.sync", async (access, request, context) => {
    const { id } = await getRouteParams(context);
    const payload = await parseJsonObject(request);
    if (!payload || !Array.isArray(payload.members)) {
      return invalidPayload('Invalid "members" field.');
    }
    const members: ProjectMemberInput[] = [];
    for (const member of payload.members) {
      if (
        !isRecord(member)
        || !isNonEmptyString(member.profileId)
        || !isProjectMemberRole(member.role)
      ) {
        return invalidPayload('Invalid "members" field.');
      }
      members.push({ profileId: member.profileId, role: member.role });
    }
    await dependencies.syncMembers(access.supabase as never, id, members);
    const dashboard = await dependencies.getDashboard(access.supabase as never, id);
    return json({ data: dashboard });
  });
}

export function createProjectsMilestonesPostHandler(dependencies: ProjectsHttpDependencies) {
  return withStaffAccess(dependencies, "projects.milestones.create", async (access, request, context) => {
    const { id } = await getRouteParams(context);
    const payload = await parseJsonObject(request);
    if (!payload) return invalidPayload();
    const input = validateInput<CreateProjectMilestoneInput>(
      payload,
      milestoneFields,
      milestoneValidators,
      ["title"],
    );
    if (isResponse(input)) return input;
    await dependencies.createMilestone(access.supabase as never, id, input);
    return json({ data: await dependencies.getDashboard(access.supabase as never, id) }, { status: 201 });
  });
}

export function createProjectsMilestonesPatchHandler(dependencies: ProjectsHttpDependencies) {
  return withStaffAccess(dependencies, "projects.milestones.update", async (access, request, context) => {
    const { id, itemId } = await getItemRouteParams(context);
    const payload = await parseJsonObject(request);
    if (!payload) return invalidPayload();
    const input = validateInput<UpdateProjectMilestoneInput>(
      payload,
      milestoneFields,
      milestoneValidators,
    );
    if (isResponse(input)) return input;
    await dependencies.updateMilestone(access.supabase as never, id, itemId, input);
    return json({ data: await dependencies.getDashboard(access.supabase as never, id) });
  });
}

export function createProjectsMilestonesDeleteHandler(dependencies: ProjectsHttpDependencies) {
  return withStaffAccess(dependencies, "projects.milestones.delete", async (access, _request, context) => {
    const { id, itemId } = await getItemRouteParams(context);
    await dependencies.deleteMilestone(access.supabase as never, id, itemId);
    return json({ data: await dependencies.getDashboard(access.supabase as never, id) });
  });
}

export function createProjectsTasksPostHandler(dependencies: ProjectsHttpDependencies) {
  return withStaffAccess(dependencies, "projects.tasks.create", async (access, request, context) => {
    const { id } = await getRouteParams(context);
    const payload = await parseJsonObject(request);
    if (!payload) return invalidPayload();
    const input = validateInput<CreateProjectTaskInput>(
      payload,
      taskFields,
      taskValidators,
      ["title"],
    );
    if (isResponse(input)) return input;
    await dependencies.createTask(access.supabase as never, id, input);
    return json({ data: await dependencies.getDashboard(access.supabase as never, id) }, { status: 201 });
  });
}

export function createProjectsTasksPatchHandler(dependencies: ProjectsHttpDependencies) {
  return withStaffAccess(dependencies, "projects.tasks.update", async (access, request, context) => {
    const { id, itemId } = await getItemRouteParams(context);
    const payload = await parseJsonObject(request);
    if (!payload) return invalidPayload();
    const input = validateInput<UpdateProjectTaskInput>(
      payload,
      taskFields,
      taskValidators,
    );
    if (isResponse(input)) return input;
    await dependencies.updateTask(access.supabase as never, id, itemId, input);
    return json({ data: await dependencies.getDashboard(access.supabase as never, id) });
  });
}

export function createProjectsTasksDeleteHandler(dependencies: ProjectsHttpDependencies) {
  return withStaffAccess(dependencies, "projects.tasks.delete", async (access, _request, context) => {
    const { id, itemId } = await getItemRouteParams(context);
    await dependencies.deleteTask(access.supabase as never, id, itemId);
    return json({ data: await dependencies.getDashboard(access.supabase as never, id) });
  });
}

export function createProjectsLinksPostHandler(dependencies: ProjectsHttpDependencies) {
  return withStaffAccess(dependencies, "projects.links.create", async (access, request, context) => {
    const { id } = await getRouteParams(context);
    const payload = await parseJsonObject(request);
    if (!payload) return invalidPayload();
    const input = validateInput<CreateProjectLinkInput>(
      payload,
      linkFields,
      linkValidators,
      ["label", "url"],
    );
    if (isResponse(input)) return input;
    await dependencies.createLink(access.supabase as never, id, input);
    return json({ data: await dependencies.getDashboard(access.supabase as never, id) }, { status: 201 });
  });
}

export function createProjectsLinksPatchHandler(dependencies: ProjectsHttpDependencies) {
  return withStaffAccess(dependencies, "projects.links.update", async (access, request, context) => {
    const { id, itemId } = await getItemRouteParams(context);
    const payload = await parseJsonObject(request);
    if (!payload) return invalidPayload();
    const input = validateInput<UpdateProjectLinkInput>(
      payload,
      linkFields,
      linkValidators,
    );
    if (isResponse(input)) return input;
    const links = await dependencies.updateLink(access.supabase as never, id, itemId, input);
    return json({ data: links });
  });
}

export function createProjectsLinksDeleteHandler(dependencies: ProjectsHttpDependencies) {
  return withStaffAccess(dependencies, "projects.links.delete", async (access, _request, context) => {
    const { id, itemId } = await getItemRouteParams(context);
    const links = await dependencies.deleteLink(access.supabase as never, id, itemId);
    return json({ data: links });
  });
}
