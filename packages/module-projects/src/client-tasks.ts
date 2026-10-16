import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CLIENT_TASK_WORKFLOWS,
  ClientTaskBoundaryError,
  isClientTaskUuid,
  parseClientTaskActionRequest,
  parseStaffClientTaskActionRequest,
  type ClientTask,
  type ClientTaskActionRequest,
  type ClientTaskSubmission,
  type ClientTaskWorkbench,
  type StaffClientTask,
  type StaffClientTaskActionRequest,
} from "./client-tasks-contracts";

type Row = Record<string, unknown>;
type RpcError = { code?: string; message?: string } | null;

function invalidResponse(): never { throw new ClientTaskBoundaryError("INVALID_RESPONSE", 502); }
function row(value: unknown): Row {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Row : invalidResponse();
}
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : invalidResponse(); }
function string(value: unknown): string { return typeof value === "string" ? value : invalidResponse(); }
function nullableString(value: unknown): string | null { return value === null ? null : string(value); }
function id(value: unknown): string { return isClientTaskUuid(value) ? value : invalidResponse(); }
function nullableId(value: unknown): string | null { return value === null ? null : id(value); }
function number(value: unknown, minimum = 0): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum ? value : invalidResponse();
}
function boolean(value: unknown): boolean { return typeof value === "boolean" ? value : invalidResponse(); }

/** Reconstruct every client response; never spread SQL rows onto a public surface. */
export function normalizeClientTask(value: unknown): ClientTask {
  const item = row(value);
  const workflow = item.workflow;
  if (!CLIENT_TASK_WORKFLOWS.some((allowed) => allowed === workflow)) return invalidResponse();
  const milestone = item.milestone === null ? null : row(item.milestone);
  return {
    id: id(item.id), projectId: id(item.project_id),
    clientTitle: string(item.client_title), clientInstructions: string(item.client_instructions),
    publicationGeneration: number(item.publication_generation),
    workflow: workflow as ClientTask["workflow"], revision: number(item.revision),
    dueDate: nullableString(item.due_date),
    milestone: milestone === null ? null : { id: id(milestone.id), title: string(milestone.title) },
    responsibleLabel: nullableString(item.responsible_label), response: nullableString(item.response),
    reviewFeedback: nullableString(item.review_feedback),
    submissionSequence: item.submission_sequence === null ? null : number(item.submission_sequence, 1),
  };
}

function normalizeSubmission(value: unknown): ClientTaskSubmission {
  const item = row(value);
  return {
    sequence: number(item.sequence, 1), taskRevision: number(item.task_revision),
    publicationGeneration: number(item.publication_generation), response: string(item.response),
    submittedAt: string(item.submitted_at), submittedByProfileId: nullableId(item.submitted_by_profile_id),
    reviewFeedback: nullableString(item.review_feedback),
  };
}

export function normalizeStaffClientTask(value: unknown): StaffClientTask {
  const item = row(value);
  if (item.publication !== "draft" && item.publication !== "published" && item.publication !== "withdrawn") return invalidResponse();
  if (item.audience_mode !== "all_eligible" && item.audience_mode !== "selected") return invalidResponse();
  return {
    ...normalizeClientTask(item), publication: item.publication,
    organizationId: id(item.organization_id), audienceMode: item.audience_mode,
    selectedProfileIds: array(item.selected_profile_ids).map(id),
    responsibleProfileId: nullableId(item.responsible_profile_id),
    submissions: array(item.submissions).map(normalizeSubmission),
  };
}

export function normalizeClientTaskWorkbench(value: unknown): ClientTaskWorkbench {
  const item = row(value);
  const capabilities = row(item.capabilities);
  return {
    tasks: array(item.tasks).map(normalizeStaffClientTask),
    organizations: array(item.organizations).map((value) => {
      const organization = row(value);
      return {
        id: id(organization.id), name: string(organization.name),
        eligibleClients: array(organization.eligible_clients).map((value) => {
          const profile = row(value);
          return { profileId: id(profile.profile_id), label: string(profile.label) };
        }),
      };
    }),
    capabilities: {
      canCreateTasks: boolean(capabilities.can_create_tasks),
      canShareClientTasks: boolean(capabilities.can_share_client_tasks),
      canReviewClientTasks: boolean(capabilities.can_review_client_tasks),
    },
  };
}

function throwRpcError(error: RpcError): void {
  if (!error) return;
  switch (error.code) {
    case "42501": throw new ClientTaskBoundaryError("FORBIDDEN", 403);
    case "40001":
    case "BW409": throw new ClientTaskBoundaryError("CONFLICT", 409);
    case "22023": throw new ClientTaskBoundaryError("INVALID_INPUT", 400);
    case "P0002": throw new ClientTaskBoundaryError("NOT_FOUND", 404);
    case "PGRST202": throw new ClientTaskBoundaryError("MIGRATION_REQUIRED", 503);
    default: throw new ClientTaskBoundaryError("REQUEST_FAILED", 500);
  }
}

function validateId(value: string): void {
  if (!isClientTaskUuid(value)) throw new ClientTaskBoundaryError("INVALID_INPUT", 400);
}
function projectTask<T extends ClientTask>(task: T, projectId: string, taskId?: string): T {
  if (task.projectId.toLowerCase() !== projectId.toLowerCase()
    || (taskId !== undefined && task.id.toLowerCase() !== taskId.toLowerCase())) return invalidResponse();
  return task;
}

/** Authenticated RPC only: task-specific eligibility is rechecked by SQL for every row. */
export async function listClientProjectTasks(supabase: SupabaseClient, projectId: string): Promise<ClientTask[]> {
  validateId(projectId);
  const { data, error } = await supabase.rpc("list_current_client_project_tasks", { p_project_id: projectId });
  if (error?.code === "42501" || error?.code === "P0002") return [];
  throwRpcError(error);
  return array(data).map((value) => projectTask(normalizeClientTask(value), projectId));
}

export async function actOnClientProjectTask(supabase: SupabaseClient, projectId: string, taskId: string, request: ClientTaskActionRequest): Promise<ClientTask> {
  validateId(projectId); validateId(taskId);
  const parsed = parseClientTaskActionRequest(request);
  const { data, error } = await supabase.rpc("act_on_current_client_project_task", {
    p_project_id: projectId, p_task_id: taskId, p_request_id: parsed.requestId,
    p_expected_revision: parsed.expectedRevision, p_action: parsed.action, p_input: parsed.input,
  });
  throwRpcError(error);
  if (data === null) throw new ClientTaskBoundaryError("NOT_FOUND", 404);
  return projectTask(normalizeClientTask(data), projectId, taskId);
}

export async function getProjectClientTaskWorkbench(supabase: SupabaseClient, projectId: string): Promise<ClientTaskWorkbench> {
  validateId(projectId);
  const { data, error } = await supabase.rpc("get_project_client_task_workbench", { p_project_id: projectId });
  throwRpcError(error);
  if (data === null) throw new ClientTaskBoundaryError("NOT_FOUND", 404);
  const workbench = normalizeClientTaskWorkbench(data);
  workbench.tasks.forEach((task) => projectTask(task, projectId));
  return workbench;
}

export async function manageProjectClientTask(supabase: SupabaseClient, projectId: string, taskId: string | null, request: StaffClientTaskActionRequest): Promise<StaffClientTask> {
  validateId(projectId);
  const parsed = parseStaffClientTaskActionRequest(request);
  if (parsed.action === "create") {
    if (taskId !== null) throw new ClientTaskBoundaryError("INVALID_INPUT", 400);
  } else {
    if (taskId === null) throw new ClientTaskBoundaryError("INVALID_INPUT", 400);
    validateId(taskId);
  }
  const { data, error } = await supabase.rpc("manage_project_client_task", {
    p_project_id: projectId, p_task_id: taskId, p_request_id: parsed.requestId,
    p_expected_revision: parsed.expectedRevision, p_action: parsed.action, p_input: parsed.input,
  });
  throwRpcError(error);
  if (data === null) throw new ClientTaskBoundaryError("NOT_FOUND", 404);
  return projectTask(normalizeStaffClientTask(data), projectId, taskId ?? undefined);
}
