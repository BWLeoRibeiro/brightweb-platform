import type { SupabaseClient } from "@supabase/supabase-js";
import {
  publicError,
  sanitizePublicError,
} from "@brightweblabs/infra/robustness";
import {
  isMilestoneStatus,
  isProjectHealth,
  isProjectLinkKind,
  isProjectLinkVisibility,
  isProjectMemberRole,
  isProjectStatus,
  isTaskPriority,
  isTaskStatus,
  parsePositiveInt,
} from "./contracts";
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
  listProjectActivity,
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

export function json(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
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
    status: isProjectStatus(status) ? status : null,
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
  if (
    message === "Indica o motivo do cancelamento."
    || message === "Motivo de bloqueio é obrigatório quando a tarefa está bloqueada."
    || message === "name é obrigatório."
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

function withUserAccess(
  dependencies: ProjectsHttpDependencies,
  errorContext: string,
  action: ProjectsAction,
) {
  return async (request: Request, context?: ProjectsRequestContext) => {
    const access = await dependencies.getAccess();
    if (!access.ok) {
      return json(publicError("ACCESS_DENIED", access.error), { status: access.status });
    }

    try {
      return await action(access, request, context);
    } catch (error) {
      return projectsErrorResponse(error, errorContext);
    }
  };
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
  "targetDate",
  "cancellationReason",
  "summary",
] as const;
const projectValidators: Record<(typeof projectFields)[number], FieldValidator> = {
  name: isNonEmptyString,
  code: nullableString,
  status: isProjectStatus,
  ownerProfileId: nullableString,
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
  dueDate: nullableString,
  position: isFiniteNumber,
  blockedReason: nullableString,
};

const milestoneFields = ["title", "status", "targetDate", "completedAt", "position"] as const;
const milestoneValidators: Record<(typeof milestoneFields)[number], FieldValidator> = {
  title: isNonEmptyString,
  status: isMilestoneStatus,
  targetDate: nullableString,
  completedAt: nullableString,
  position: isFiniteNumber,
};

const linkFields = ["label", "url", "visibility", "kind"] as const;
const linkValidators: Record<(typeof linkFields)[number], FieldValidator> = {
  label: isNonEmptyString,
  url: isNonEmptyString,
  visibility: isProjectLinkVisibility,
  kind: isProjectLinkKind,
};

export function createProjectsGetHandler(dependencies: ProjectsHttpDependencies) {
  return withUserAccess(dependencies, "projects.list", async (access, request) => {
    const result = await dependencies.listProjects(
      access.supabase as never,
      parseProjectsListRequest(request),
    );
    return json(result);
  });
}

export function createProjectsStatsGetHandler(dependencies: ProjectsHttpDependencies) {
  return withUserAccess(dependencies, "projects.stats", async (access) => {
    return json(await dependencies.getPortfolioStats(access.supabase as never));
  });
}

export function createProjectsDashboardOverviewGetHandler(dependencies: ProjectsHttpDependencies) {
  return withUserAccess(dependencies, "projects.dashboard-overview", async (access) => {
    return json({ data: await dependencies.getProjectsDashboardData(access.supabase as never) });
  });
}

export function createTasksDashboardGetHandler(dependencies: ProjectsHttpDependencies) {
  return withUserAccess(dependencies, "projects.tasks-dashboard", async (access) => {
    return json({
      data: await dependencies.getTasksDashboardData(
        access.supabase as never,
        access.profileId,
      ),
    });
  });
}

export function createProjectsDashboardGetHandler(dependencies: ProjectsHttpDependencies) {
  return withUserAccess(dependencies, "projects.dashboard", async (access, _request, context) => {
    const { id } = await getRouteParams(context);
    return json(await dependencies.getDashboard(access.supabase as never, id));
  });
}

export function createProjectsActivityGetHandler(dependencies: ProjectsHttpDependencies) {
  return withUserAccess(dependencies, "projects.activity", async (access, _request, context) => {
    const { id } = await getRouteParams(context);
    return json(await dependencies.listActivity(access.supabase as never, id));
  });
}

export function createProjectsOrganizationsGetHandler(dependencies: ProjectsHttpDependencies) {
  return withUserAccess(dependencies, "projects.organizations.list", async (access) => {
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
    const fields = ["organizationId", ...projectFields] as const;
    const input = validateInput<CreateProjectInput>(
      payload,
      fields,
      { organizationId: isNonEmptyString, ...projectValidators },
      ["organizationId", "name"],
    );
    if (isResponse(input)) return input;
    const dashboard = await dependencies.createProject(access.supabase as never, input);
    return json({
      data: {
        id: dashboard.project.id,
        name: dashboard.project.name,
        ownerProfileId: dashboard.project.ownerProfileId,
      },
    }, { status: 201 });
  });
}

export function createProjectsPatchHandler(dependencies: ProjectsHttpDependencies) {
  return withStaffAccess(dependencies, "projects.update", async (access, request, context) => {
    const { id } = await getRouteParams(context);
    const payload = await parseJsonObject(request);
    if (!payload) return invalidPayload();
    const input = validateInput<UpdateProjectInput>(
      payload,
      projectFields,
      projectValidators,
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
    return new Response(null, { status: 204 });
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
