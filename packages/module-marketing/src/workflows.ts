import type {
  MarketingEmailMessage,
  MarketingEmailSender,
} from "./email/types";

type QueryError = { message?: string } | null;

type WorkflowClient = {
  from: (table: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{
    data: unknown;
    error: QueryError;
  }>;
};

export type WorkflowTriggerType =
  | "contact_subscribed"
  | "crm_status_changed"
  | "project_status_changed"
  | "form_submitted";

export type WorkflowStatus = "draft" | "active" | "paused";
export type WorkflowNodeType = "send_email" | "wait" | "add_tag";

export type MarketingWorkflow = {
  id: string;
  name: string;
  description: string | null;
  triggerType: WorkflowTriggerType;
  triggerConfig: Record<string, unknown>;
  status: WorkflowStatus;
  createdByProfileId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MarketingWorkflowListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: WorkflowStatus | null;
};
export type MarketingWorkflowListResult = {
  items: MarketingWorkflow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type MarketingWorkflowNode = {
  id: string;
  workflowId: string;
  position: number;
  nodeType: WorkflowNodeType;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type MarketingWorkflowWithNodes = MarketingWorkflow & {
  nodes: MarketingWorkflowNode[];
};

export type CreateWorkflowInput = {
  name: string;
  description?: string | null;
  triggerType: WorkflowTriggerType;
  triggerConfig?: Record<string, unknown>;
  createdByProfileId?: string | null;
};

export type UpdateWorkflowInput = Partial<
  Pick<CreateWorkflowInput, "name" | "description" | "triggerType" | "triggerConfig">
>;

export type UpsertWorkflowNodeInput = {
  id?: string;
  position: number;
  nodeType: WorkflowNodeType;
  config?: Record<string, unknown>;
};

type WorkflowRow = {
  id: string;
  name: string;
  description: string | null;
  trigger_type: WorkflowTriggerType;
  trigger_config: Record<string, unknown> | null;
  status: WorkflowStatus;
  created_by_profile_id: string | null;
  created_at: string;
  updated_at: string;
};

type NodeRow = {
  id: string;
  workflow_id: string;
  position: number;
  node_type: WorkflowNodeType;
  config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type WorkflowRunRow = {
  id: string;
  workflow_id: string;
  contact_id: string | null;
  status: "active" | "completed" | "failed" | "canceled";
  current_position: number;
  next_run_at: string | null;
  context: Record<string, unknown> | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

function db(supabase: unknown) {
  return supabase as WorkflowClient;
}

function throwIfError(error: QueryError | undefined) {
  if (error) throw new Error(error.message || "Marketing workflow database request failed.");
}

function workflowFromRow(row: WorkflowRow): MarketingWorkflow {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    triggerType: row.trigger_type,
    triggerConfig: row.trigger_config ?? {},
    status: row.status,
    createdByProfileId: row.created_by_profile_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function nodeFromRow(row: NodeRow): MarketingWorkflowNode {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    position: row.position,
    nodeType: row.node_type,
    config: row.config ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function requireName(name: string) {
  const value = name.trim();
  if (!value) throw new Error("Workflow name is required.");
  return value;
}

export async function listWorkflows(supabase: unknown) {
  const result = await db(supabase)
    .from("marketing_workflows")
    .select("*")
    .order("created_at", { ascending: false });
  throwIfError(result.error);
  return ((result.data ?? []) as WorkflowRow[]).map(workflowFromRow);
}

export async function queryWorkflows(
  supabase: unknown,
  params: MarketingWorkflowListParams = {},
): Promise<MarketingWorkflowListResult> {
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(params.pageSize ?? 20)));
  const from = (page - 1) * pageSize;
  let query = db(supabase)
    .from("marketing_workflows")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (params.status) query = query.eq("status", params.status);
  const search = params.search?.trim().toLowerCase().replace(/[%_,()\"]/g, "");
  if (search) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  const { data, error, count } = await query;
  throwIfError(error);
  const total = count ?? 0;
  return {
    items: ((data ?? []) as WorkflowRow[]).map(workflowFromRow),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getWorkflow(
  supabase: unknown,
  workflowId: string,
): Promise<MarketingWorkflowWithNodes | null> {
  const workflowResult = await db(supabase)
    .from("marketing_workflows")
    .select("*")
    .eq("id", workflowId)
    .maybeSingle();
  throwIfError(workflowResult.error);
  if (!workflowResult.data) return null;
  const nodesResult = await db(supabase)
    .from("marketing_workflow_nodes")
    .select("*")
    .eq("workflow_id", workflowId)
    .order("position", { ascending: true });
  throwIfError(nodesResult.error);
  return {
    ...workflowFromRow(workflowResult.data as WorkflowRow),
    nodes: ((nodesResult.data ?? []) as NodeRow[]).map(nodeFromRow),
  };
}

export async function createWorkflow(
  supabase: unknown,
  input: CreateWorkflowInput,
) {
  const result = await db(supabase)
    .from("marketing_workflows")
    .insert({
      name: requireName(input.name),
      description: input.description?.trim() || null,
      trigger_type: input.triggerType,
      trigger_config: input.triggerConfig ?? {},
      created_by_profile_id: input.createdByProfileId ?? null,
    })
    .select("*")
    .single();
  throwIfError(result.error);
  return workflowFromRow(result.data as WorkflowRow);
}

export async function updateWorkflow(
  supabase: unknown,
  workflowId: string,
  input: UpdateWorkflowInput,
) {
  const payload = {
    ...(input.name !== undefined ? { name: requireName(input.name) } : {}),
    ...(input.description !== undefined
      ? { description: input.description?.trim() || null }
      : {}),
    ...(input.triggerType !== undefined ? { trigger_type: input.triggerType } : {}),
    ...(input.triggerConfig !== undefined
      ? { trigger_config: input.triggerConfig }
      : {}),
  };
  const result = await db(supabase)
    .from("marketing_workflows")
    .update(payload)
    .eq("id", workflowId)
    .select("*")
    .single();
  throwIfError(result.error);
  return workflowFromRow(result.data as WorkflowRow);
}

export async function deleteWorkflow(supabase: unknown, workflowId: string) {
  const result = await db(supabase)
    .from("marketing_workflows")
    .delete()
    .eq("id", workflowId)
    .eq("status", "draft")
    .select("id");
  throwIfError(result.error);
  if (!(result.data ?? []).length) {
    throw new Error("Only draft workflows can be deleted.");
  }
}

async function setWorkflowStatus(
  supabase: unknown,
  workflowId: string,
  status: Extract<WorkflowStatus, "active" | "paused">,
) {
  if (status === "active") {
    const workflow = await getWorkflow(supabase, workflowId);
    if (!workflow) throw new Error("Workflow not found.");
    if (!workflow.nodes.length) {
      throw new Error("A workflow must have at least one node before activation.");
    }
  }
  const result = await db(supabase)
    .from("marketing_workflows")
    .update({ status })
    .eq("id", workflowId)
    .select("*")
    .single();
  throwIfError(result.error);
  return workflowFromRow(result.data as WorkflowRow);
}

export function activateWorkflow(supabase: unknown, workflowId: string) {
  return setWorkflowStatus(supabase, workflowId, "active");
}

export function pauseWorkflow(supabase: unknown, workflowId: string) {
  return setWorkflowStatus(supabase, workflowId, "paused");
}

export async function upsertWorkflowNodes(
  supabase: unknown,
  workflowId: string,
  nodes: UpsertWorkflowNodeInput[],
) {
  const workflow = await getWorkflow(supabase, workflowId);
  if (!workflow) throw new Error("Workflow not found.");
  if (workflow.status === "active") {
    throw new Error("Pause the workflow before editing its nodes.");
  }
  const normalized = nodes
    .slice()
    .sort((left, right) => left.position - right.position)
    .map((node, position) => ({
      ...(node.id ? { id: node.id } : {}),
      workflow_id: workflowId,
      position,
      node_type: node.nodeType,
      config: node.config ?? {},
    }));
  const existingIds = new Set(nodes.flatMap((node) => node.id ? [node.id] : []));
  for (const existing of workflow.nodes) {
    if (!existingIds.has(existing.id)) {
      const deletion = await db(supabase)
        .from("marketing_workflow_nodes")
        .delete()
        .eq("id", existing.id)
        .eq("workflow_id", workflowId);
      throwIfError(deletion.error);
    }
  }
  if (normalized.length) {
    const upsert = await db(supabase)
      .from("marketing_workflow_nodes")
      .upsert(normalized, { onConflict: "id" });
    throwIfError(upsert.error);
  }
  return (await getWorkflow(supabase, workflowId))!.nodes;
}

export async function deleteWorkflowNode(
  supabase: unknown,
  workflowId: string,
  nodeId: string,
) {
  const workflow = await getWorkflow(supabase, workflowId);
  if (!workflow) throw new Error("Workflow not found.");
  return upsertWorkflowNodes(
    supabase,
    workflowId,
    workflow.nodes
      .filter((node) => node.id !== nodeId)
      .map((node) => ({
        id: node.id,
        position: node.position,
        nodeType: node.nodeType,
        config: node.config,
      })),
  );
}

export async function listWorkflowRuns(supabase: unknown, workflowId: string) {
  const result = await db(supabase)
    .from("marketing_workflow_runs")
    .select("*")
    .eq("workflow_id", workflowId)
    .order("created_at", { ascending: false });
  throwIfError(result.error);
  return result.data ?? [];
}

function matchesConfig(
  config: Record<string, unknown> | null,
  matchData: Record<string, unknown>,
) {
  return Object.entries(config ?? {}).every(
    ([key, value]) => matchData[key] === value,
  );
}

export async function enqueueWorkflowRunsForTrigger(
  supabase: unknown,
  input: {
    triggerType: WorkflowTriggerType;
    contactId: string;
    matchData?: Record<string, unknown>;
  },
) {
  const workflowsResult = await db(supabase)
    .from("marketing_workflows")
    .select("id,trigger_config")
    .eq("status", "active")
    .eq("trigger_type", input.triggerType);
  throwIfError(workflowsResult.error);
  const matching = ((workflowsResult.data ?? []) as Array<{
    id: string;
    trigger_config: Record<string, unknown> | null;
  }>).filter((workflow) => matchesConfig(
    workflow.trigger_config,
    input.matchData ?? {},
  ));
  if (!matching.length) return 0;
  // Workflow re-entry is deliberately one-shot per contact unless a future
  // workflow version introduces an explicit repeat policy.
  const result = await db(supabase)
    .from("marketing_workflow_runs")
    .upsert(
      matching.map((workflow) => ({
        workflow_id: workflow.id,
        contact_id: input.contactId,
        status: "active",
        current_position: 0,
        next_run_at: new Date().toISOString(),
        context: input.matchData ?? {},
      })),
      {
        onConflict: "workflow_id,contact_id",
        ignoreDuplicates: true,
      },
    )
    .select("id");
  throwIfError(result.error);
  return (result.data ?? []).length;
}

export function enqueueFormSubmission(
  supabase: unknown,
  input: {
    contactId: string;
    formId: string;
    submissionId?: string;
    values?: Record<string, unknown>;
  },
) {
  return enqueueWorkflowRunsForTrigger(supabase, {
    triggerType: "form_submitted",
    contactId: input.contactId,
    matchData: {
      formId: input.formId,
      ...(input.submissionId ? { submissionId: input.submissionId } : {}),
      ...(input.values ? { values: input.values } : {}),
    },
  });
}

type ActivityRow = {
  id: string;
  domain: string;
  event_type?: string | null;
  entity_table?: string | null;
  entity_id?: string | null;
  payload?: Record<string, unknown> | null;
  created_at: string;
};

function stringValue(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (typeof record[key] === "string" && record[key]) return record[key] as string;
  }
  return null;
}

function nestedStatusValue(data: Record<string, unknown>) {
  const changes = data.changes;
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) return null;
  const status = (changes as Record<string, unknown>).status;
  if (!status || typeof status !== "object" || Array.isArray(status)) return null;
  return stringValue(status as Record<string, unknown>, "to");
}

function statusChange(row: ActivityRow) {
  const data = row.payload ?? {};
  const expectedEvent = row.domain === "crm"
    ? "crm_contact_status_changed"
    : row.domain === "projects"
      ? "project_status_changed"
      : null;
  const toStatus = stringValue(
    data,
    "toStatus",
    "to_status",
    "newStatus",
    "new_status",
  ) ?? nestedStatusValue(data);
  return row.event_type === expectedEvent && toStatus
    ? { data, toStatus }
    : null;
}

async function contactIdForOrganization(supabase: unknown, organizationId: string) {
  const contact = await db(supabase)
    .from("crm_contacts")
    .select("id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  throwIfError(contact.error);
  return typeof contact.data?.id === "string" ? contact.data.id : null;
}

async function contactIdForActivity(supabase: unknown, row: ActivityRow) {
  const data = row.payload ?? {};
  const explicit = stringValue(data, "contactId", "contact_id");
  if (explicit) return explicit;
  if (
    row.domain === "crm"
    && row.entity_id
    && (row.entity_table === "crm_contacts" || row.entity_table === "contacts")
  ) {
    return row.entity_id;
  }
  const profileId = stringValue(data, "profileId", "profile_id");
  if (profileId) {
    const contact = await db(supabase)
      .from("crm_contacts")
      .select("id")
      .eq("profile_id", profileId)
      .limit(1)
      .maybeSingle();
    throwIfError(contact.error);
    if (contact.data?.id) return contact.data.id as string;
  }
  const organizationId = stringValue(data, "organizationId", "organization_id");
  if (organizationId) {
    return contactIdForOrganization(supabase, organizationId);
  }
  if (row.domain === "projects") {
    const projectId = stringValue(data, "projectId", "project_id")
      ?? (
        row.entity_table === "projects" && row.entity_id
          ? row.entity_id
          : null
      );
    if (projectId) {
      const project = await db(supabase)
        .from("projects")
        .select("organization_id")
        .eq("id", projectId)
        .maybeSingle();
      throwIfError(project.error);
      if (typeof project.data?.organization_id === "string") {
        return contactIdForOrganization(supabase, project.data.organization_id);
      }
    }
  }
  return null;
}

async function activityEventsAfterCursor(
  supabase: unknown,
  cursor: string | null,
  cursorId: string | null,
  limit: number,
) {
  const baseQuery = () => db(supabase)
    .from("app_activity_events")
    .select("*")
    .in("domain", ["crm", "projects"]);
  if (!cursor || !cursorId) {
    const result = await baseQuery()
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(limit);
    throwIfError(result.error);
    return (result.data ?? []) as ActivityRow[];
  }

  const sameTimestamp = await baseQuery()
    .eq("created_at", cursor)
    .gt("id", cursorId)
    .order("id", { ascending: true })
    .limit(limit);
  throwIfError(sameTimestamp.error);
  const events = (sameTimestamp.data ?? []) as ActivityRow[];
  if (events.length >= limit) return events;

  const later = await baseQuery()
    .gt("created_at", cursor)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(limit - events.length);
  throwIfError(later.error);
  return events.concat((later.data ?? []) as ActivityRow[]);
}

export async function scanActivityTriggers(
  supabase: unknown,
  options: { limit?: number } = {},
) {
  const cursorResult = await db(supabase)
    .from("marketing_worker_cursors")
    .select("cursor,cursor_id")
    .eq("key", "activity_triggers")
    .maybeSingle();
  throwIfError(cursorResult.error);
  const limit = Math.max(1, Math.min(options.limit ?? 100, 500));
  const events = await activityEventsAfterCursor(
    supabase,
    typeof cursorResult.data?.cursor === "string"
      ? cursorResult.data.cursor
      : null,
    typeof cursorResult.data?.cursor_id === "string"
      ? cursorResult.data.cursor_id
      : null,
    limit,
  );
  let enqueued = 0;
  for (const event of events) {
    const change = statusChange(event);
    if (!change) continue;
    const contactId = await contactIdForActivity(supabase, event);
    if (!contactId) continue;
    enqueued += await enqueueWorkflowRunsForTrigger(supabase, {
      triggerType: event.domain === "crm"
        ? "crm_status_changed"
        : "project_status_changed",
      contactId,
      matchData: {
        ...change.data,
        toStatus: change.toStatus,
        activityEventId: event.id,
      },
    });
  }
  if (events.length) {
    const lastEvent = events[events.length - 1]!;
    const update = await db(supabase)
      .from("marketing_worker_cursors")
      .upsert(
        {
          key: "activity_triggers",
          cursor: lastEvent.created_at,
          cursor_id: lastEvent.id,
        },
        { onConflict: "key" },
      );
    throwIfError(update.error);
  }
  return { scanned: events.length, enqueued };
}

async function contactForSend(
  supabase: unknown,
  contactId: string,
  topicId: string | null,
) {
  if (!topicId || !(await (await import("./server")).isEmailable(
    supabase,
    contactId,
    topicId,
  ))) {
    return null;
  }
  const contactResult = await db(supabase)
    .from("crm_contacts")
    .select("id,email")
    .eq("id", contactId)
    .maybeSingle();
  throwIfError(contactResult.error);
  const email = contactResult.data?.email;
  if (typeof email !== "string" || !email.trim()) return null;
  return { email: email.trim() };
}

async function completedStep(
  supabase: unknown,
  runId: string,
  nodeId: string,
) {
  const result = await db(supabase)
    .from("marketing_workflow_step_runs")
    .select("status")
    .eq("run_id", runId)
    .eq("node_id", nodeId)
    .in("status", ["done", "skipped"])
    .maybeSingle();
  throwIfError(result.error);
  return Boolean(result.data);
}

function requiredString(config: Record<string, unknown>, key: string) {
  const value = config[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Workflow node config.${key} is required.`);
  }
  return value.trim();
}

async function recordStep(
  supabase: unknown,
  runId: string,
  nodeId: string,
  status: "done" | "failed" | "skipped",
  error?: string,
) {
  const result = await db(supabase)
    .from("marketing_workflow_step_runs")
    .insert({
      run_id: runId,
      node_id: nodeId,
      status,
      error: error?.slice(0, 2000) ?? null,
    });
  throwIfError(result.error);
}

async function updateRun(
  supabase: unknown,
  runId: string,
  payload: Record<string, unknown>,
) {
  const result = await db(supabase)
    .from("marketing_workflow_runs")
    .update(payload)
    .eq("id", runId)
    .eq("status", "active");
  throwIfError(result.error);
}

async function executeRun(
  supabase: unknown,
  sender: MarketingEmailSender,
  run: WorkflowRunRow,
  now: Date,
) {
  if (!run.contact_id) {
    await updateRun(supabase, run.id, {
      status: "failed",
      next_run_at: null,
      completed_at: now.toISOString(),
    });
    return "failed" as const;
  }
  const workflowResult = await db(supabase)
    .from("marketing_workflows")
    .select("id,status")
    .eq("id", run.workflow_id)
    .maybeSingle();
  throwIfError(workflowResult.error);
  if (!workflowResult.data || workflowResult.data.status !== "active") {
    await updateRun(supabase, run.id, {
      next_run_at: new Date(now.getTime() + 60_000).toISOString(),
    });
    return "deferred" as const;
  }
  const nodesResult = await db(supabase)
    .from("marketing_workflow_nodes")
    .select("*")
    .eq("workflow_id", run.workflow_id)
    .order("position", { ascending: true });
  throwIfError(nodesResult.error);
  const nodes = (nodesResult.data ?? []) as NodeRow[];
  const node = nodes[run.current_position];
  if (!node) {
    await updateRun(supabase, run.id, {
      status: "completed",
      next_run_at: null,
      completed_at: now.toISOString(),
    });
    return "completed" as const;
  }

  if (
    node.node_type === "send_email"
    && await completedStep(supabase, run.id, node.id)
  ) {
    const nextPosition = run.current_position + 1;
    const completed = nextPosition >= nodes.length;
    await updateRun(supabase, run.id, {
      current_position: nextPosition,
      status: completed ? "completed" : "active",
      next_run_at: completed ? null : now.toISOString(),
      completed_at: completed ? now.toISOString() : null,
    });
    return completed ? "completed" as const : "advanced" as const;
  }

  try {
    let stepStatus: "done" | "skipped" = "done";
    let nextRunAt: string | null = now.toISOString();
    if (node.node_type === "send_email") {
      const topicId = typeof node.config?.topicId === "string"
        ? node.config.topicId
        : null;
      const contact = await contactForSend(supabase, run.contact_id, topicId);
      if (!contact) {
        stepStatus = "skipped";
      } else {
        const message: MarketingEmailMessage = {
          to: contact.email,
          subject: requiredString(node.config ?? {}, "subject"),
          html: typeof node.config?.bodyHtml === "string"
            ? node.config.bodyHtml
            : undefined,
          text: typeof node.config?.bodyText === "string"
            ? node.config.bodyText
            : undefined,
          tags: [
            { name: "workflow_id", value: run.workflow_id },
            { name: "workflow_run_id", value: run.id },
          ],
        };
        const [sendResult] = await sender.sendBatch([message]);
        if (!sendResult?.ok) {
          throw new Error(sendResult?.error || "Email sender returned no result.");
        }
        const event = await db(supabase)
          .from("marketing_message_events")
          .insert({
            contact_id: run.contact_id,
            provider: "workflow",
            event_type: "sent",
            provider_event_id: sendResult.providerMessageId ?? null,
            payload: { workflowId: run.workflow_id, workflowRunId: run.id },
            occurred_at: now.toISOString(),
          });
        throwIfError(event.error);
      }
    } else if (node.node_type === "wait") {
      const duration = Number(node.config?.durationMinutes);
      if (!Number.isFinite(duration) || duration < 0) {
        throw new Error("Workflow wait durationMinutes must be a non-negative number.");
      }
      nextRunAt = new Date(now.getTime() + duration * 60_000).toISOString();
    } else if (node.node_type === "add_tag") {
      const tag = requiredString(node.config ?? {}, "tag");
      const tagResult = await db(supabase)
        .from("marketing_contact_tags")
        .upsert(
          { contact_id: run.contact_id, tag },
          { onConflict: "contact_id,tag", ignoreDuplicates: true },
        );
      throwIfError(tagResult.error);
    }

    await recordStep(supabase, run.id, node.id, stepStatus);
    const nextPosition = run.current_position + 1;
    const completed = nextPosition >= nodes.length;
    await updateRun(supabase, run.id, {
      current_position: nextPosition,
      status: completed ? "completed" : "active",
      next_run_at: completed ? null : nextRunAt,
      completed_at: completed ? now.toISOString() : null,
    });
    return completed ? "completed" as const : "advanced" as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Workflow step failed.";
    await recordStep(supabase, run.id, node.id, "failed", message);
    await updateRun(supabase, run.id, {
      status: "failed",
      next_run_at: null,
      completed_at: now.toISOString(),
    });
    return "failed" as const;
  }
}

export async function processDueWorkflowRuns(
  supabase: unknown,
  dependencies: { sender: MarketingEmailSender; now?: () => Date },
  options: { limit?: number } = {},
) {
  const now = (dependencies.now ?? (() => new Date()))();
  const claim = await db(supabase).rpc("claim_marketing_workflow_runs", {
    claim_limit: Math.max(1, Math.min(options.limit ?? 25, 100)),
    claim_time: now.toISOString(),
  });
  throwIfError(claim.error);
  const runs = (claim.data ?? []) as WorkflowRunRow[];
  let completed = 0;
  let failed = 0;
  for (const run of runs) {
    const outcome = await executeRun(supabase, dependencies.sender, run, now);
    if (outcome === "completed") completed += 1;
    if (outcome === "failed") failed += 1;
  }
  return {
    claimed: runs.length,
    completed,
    failed,
  };
}
