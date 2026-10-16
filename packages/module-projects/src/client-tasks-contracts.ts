export const CLIENT_TASK_WORKFLOWS = ["open", "in_progress", "submitted", "returned", "accepted"] as const;
export type ClientTaskWorkflow = typeof CLIENT_TASK_WORKFLOWS[number];
export type ClientTaskPublication = "draft" | "published" | "withdrawn";
export type ClientTaskAudienceMode = "all_eligible" | "selected";

export type ClientTask = {
  id: string;
  projectId: string;
  clientTitle: string;
  clientInstructions: string;
  publicationGeneration: number;
  workflow: ClientTaskWorkflow;
  revision: number;
  dueDate: string | null;
  milestone: { id: string; title: string } | null;
  responsibleLabel: string | null;
  response: string | null;
  reviewFeedback: string | null;
  submissionSequence: number | null;
};

export type ClientTaskSubmission = {
  sequence: number;
  taskRevision: number;
  publicationGeneration: number;
  response: string;
  submittedAt: string;
  submittedByProfileId: string | null;
  reviewFeedback: string | null;
};

export type StaffClientTask = ClientTask & {
  publication: ClientTaskPublication;
  organizationId: string;
  audienceMode: ClientTaskAudienceMode;
  selectedProfileIds: string[];
  responsibleProfileId: string | null;
  submissions: ClientTaskSubmission[];
};

export type ClientTaskCapabilities = {
  canCreateTasks: boolean;
  canShareClientTasks: boolean;
  canReviewClientTasks: boolean;
};

export type ClientTaskWorkbench = {
  tasks: StaffClientTask[];
  organizations: Array<{
    id: string;
    name: string;
    eligibleClients: Array<{ profileId: string; label: string }>;
  }>;
  capabilities: ClientTaskCapabilities;
};

export type ClientTaskConfigurationInput = {
  clientTitle: string;
  clientInstructions: string;
  organizationId: string;
  audienceMode: ClientTaskAudienceMode;
  selectedProfileIds: string[];
  responsibleProfileId: string | null;
  milestoneId: string | null;
  dueDate: string | null;
};

type ActionRequest<Action extends string, Input, Revision = number> = {
  requestId: string;
  expectedRevision: Revision;
  action: Action;
  input: Input;
};

export type ClientTaskActionRequest =
  | ActionRequest<"start", Record<string, never>>
  | ActionRequest<"submit", { response: string }>;

export type StaffClientTaskActionRequest =
  | ActionRequest<"create", ClientTaskConfigurationInput, null>
  | ActionRequest<"configure", ClientTaskConfigurationInput>
  | ActionRequest<"publish" | "withdraw", Record<string, never>>
  | ActionRequest<"return" | "accept", { submissionSequence: number; feedback: string }>;

export const CLIENT_TASK_LIMITS = {
  title: 240,
  instructions: 20_000,
  response: 20_000,
  feedback: 20_000,
  selectedProfiles: 500,
  bodyBytes: 128 * 1024,
} as const;

type ClientTaskBoundaryErrorCode = "INVALID_INPUT" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "MIGRATION_REQUIRED" | "INVALID_RESPONSE" | "REQUEST_FAILED";

export class ClientTaskBoundaryError extends Error {
  readonly code: ClientTaskBoundaryErrorCode;
  readonly status: number;

  constructor(code: ClientTaskBoundaryErrorCode, status: number) {
    super(code);
    this.name = "ClientTaskBoundaryError";
    this.code = code;
    this.status = status;
  }
}

export function isClientTaskUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function invalid(): never { throw new ClientTaskBoundaryError("INVALID_INPUT", 400); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function exact(value: unknown, keys: string[]): Record<string, unknown> {
  const item = object(value);
  if (Object.keys(item).length !== keys.length || keys.some((key) => !Object.hasOwn(item, key))) return invalid();
  return item;
}
function text(value: unknown, limit: number, nonblank = false): string {
  if (typeof value !== "string" || value.length > limit || (nonblank && !value.trim())) return invalid();
  return value;
}
function uuid(value: unknown): string { return isClientTaskUuid(value) ? value : invalid(); }
function nullableUuid(value: unknown): string | null { return value === null ? null : uuid(value); }
function integer(value: unknown, minimum: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= 2_147_483_647 ? value : invalid();
}
function configuration(value: unknown): ClientTaskConfigurationInput {
  const input = exact(value, ["clientTitle", "clientInstructions", "organizationId", "audienceMode", "selectedProfileIds", "responsibleProfileId", "milestoneId", "dueDate"]);
  if (input.audienceMode !== "all_eligible" && input.audienceMode !== "selected") return invalid();
  if (!Array.isArray(input.selectedProfileIds) || input.selectedProfileIds.length > CLIENT_TASK_LIMITS.selectedProfiles) return invalid();
  const selectedProfileIds = input.selectedProfileIds.map(uuid);
  if (new Set(selectedProfileIds.map((id) => id.toLowerCase())).size !== selectedProfileIds.length) return invalid();
  if (input.audienceMode === "all_eligible" && selectedProfileIds.length !== 0) return invalid();
  const dueDate = input.dueDate === null ? null : text(input.dueDate, 10);
  if (dueDate !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !Number.isFinite(Date.parse(dueDate)) || new Date(dueDate).toISOString().slice(0, 10) !== dueDate)) return invalid();
  return {
    clientTitle: text(input.clientTitle, CLIENT_TASK_LIMITS.title, true),
    clientInstructions: text(input.clientInstructions, CLIENT_TASK_LIMITS.instructions),
    organizationId: uuid(input.organizationId), audienceMode: input.audienceMode,
    selectedProfileIds, responsibleProfileId: nullableUuid(input.responsibleProfileId),
    milestoneId: nullableUuid(input.milestoneId), dueDate,
  };
}

export function parseClientTaskActionRequest(value: unknown): ClientTaskActionRequest {
  const item = exact(value, ["requestId", "expectedRevision", "action", "input"]);
  const common = { requestId: uuid(item.requestId), expectedRevision: integer(item.expectedRevision, 0) };
  if (item.action === "start") return { ...common, action: "start", input: exact(item.input, []) as Record<string, never> };
  if (item.action === "submit") {
    const input = exact(item.input, ["response"]);
    return { ...common, action: "submit", input: { response: text(input.response, CLIENT_TASK_LIMITS.response, true) } };
  }
  return invalid();
}

export function parseStaffClientTaskActionRequest(value: unknown): StaffClientTaskActionRequest {
  const item = exact(value, ["requestId", "expectedRevision", "action", "input"]);
  const requestId = uuid(item.requestId);
  if (item.action === "create") {
    if (item.expectedRevision !== null) return invalid();
    return { requestId, expectedRevision: null, action: "create", input: configuration(item.input) };
  }
  const common = { requestId, expectedRevision: integer(item.expectedRevision, 0) };
  if (item.action === "configure") return { ...common, action: "configure", input: configuration(item.input) };
  if (item.action === "publish" || item.action === "withdraw") return { ...common, action: item.action, input: exact(item.input, []) as Record<string, never> };
  if (item.action === "return" || item.action === "accept") {
    const input = exact(item.input, ["submissionSequence", "feedback"]);
    return { ...common, action: item.action, input: { submissionSequence: integer(input.submissionSequence, 1), feedback: text(input.feedback, CLIENT_TASK_LIMITS.feedback, item.action === "return") } };
  }
  return invalid();
}
