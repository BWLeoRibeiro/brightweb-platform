import { readPublicError } from "@brightweblabs/infra/robustness";
import type {
  MarketingCampaign,
  MarketingCampaignInput,
  MarketingCampaignRecipient,
  MarketingTopic,
  MarketingSegment,
  MarketingSegmentInput,
  MarketingSegmentPreview,
  MarketingUiClient,
  MarketingWorkflow,
  MarketingWorkflowInput,
  MarketingWorkflowNode,
  MarketingWorkflowNodeInput,
  MarketingWorkflowRun,
} from "./types";
import type {
  MarketingCampaignAnalytics,
  MarketingOverviewMetrics,
  MarketingSegmentAnalytics,
} from "../analytics";

async function readPayload(response: Response): Promise<unknown> {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      readPublicError(payload, response.statusText || "Marketing request failed.").message,
    );
  }
  return payload;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function unwrap<T>(payload: unknown, key: string): T {
  const record = asRecord(payload);
  return (record[key] ?? record.data ?? payload) as T;
}

function parseCampaign(payload: unknown): MarketingCampaign {
  return unwrap<MarketingCampaign>(payload, "campaign");
}

function parseCampaigns(payload: unknown): MarketingCampaign[] {
  const campaigns = unwrap<unknown[]>(payload, "campaigns");
  return Array.isArray(campaigns) ? campaigns.map(parseCampaign) : [];
}

function parseRecipients(payload: unknown): MarketingCampaignRecipient[] {
  const recipients = unwrap<unknown[]>(payload, "recipients");
  if (!Array.isArray(recipients)) return [];
  return recipients.map((value) => {
    const row = asRecord(value);
    return {
      id: String(row.id ?? ""),
      contactId: typeof row.contactId === "string"
        ? row.contactId
        : typeof row.contact_id === "string" ? row.contact_id : null,
      email: String(row.email ?? ""),
      status: String(row.status ?? "queued") as MarketingCampaignRecipient["status"],
      error: typeof row.error === "string" ? row.error : null,
      sentAt: typeof row.sentAt === "string"
        ? row.sentAt
        : typeof row.sent_at === "string" ? row.sent_at : null,
    };
  });
}

function parseTopics(payload: unknown): MarketingTopic[] {
  const topics = unwrap<MarketingTopic[]>(payload, "topics");
  return Array.isArray(topics) ? topics : [];
}

function parseSegment(payload: unknown): MarketingSegment {
  return unwrap<MarketingSegment>(payload, "segment");
}

function parseSegments(payload: unknown): MarketingSegment[] {
  const segments = unwrap<unknown[]>(payload, "segments");
  return Array.isArray(segments) ? segments.map(parseSegment) : [];
}

function parseWorkflowNode(value: unknown): MarketingWorkflowNode {
  const row = asRecord(value);
  return {
    id: String(row.id ?? ""),
    workflowId: String(row.workflowId ?? row.workflow_id ?? ""),
    type: String(row.nodeType ?? row.node_type ?? row.type ?? "wait") as MarketingWorkflowNode["type"],
    position: Number(row.position ?? 0),
    config: asRecord(row.config),
    createdAt: typeof row.createdAt === "string"
      ? row.createdAt
      : typeof row.created_at === "string" ? row.created_at : undefined,
    updatedAt: typeof row.updatedAt === "string"
      ? row.updatedAt
      : typeof row.updated_at === "string" ? row.updated_at : undefined,
  };
}

function parseWorkflow(payload: unknown): MarketingWorkflow {
  const row = asRecord(unwrap<unknown>(payload, "workflow"));
  const rawNodes = Array.isArray(row.nodes) ? row.nodes : [];
  const nodes = rawNodes.map(parseWorkflowNode).sort((a, b) => a.position - b.position);
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    description: typeof row.description === "string" ? row.description : null,
    triggerType: String(row.triggerType ?? row.trigger_type ?? "contact_subscribed") as MarketingWorkflow["triggerType"],
    triggerConfig: asRecord(row.triggerConfig ?? row.trigger_config) as MarketingWorkflow["triggerConfig"],
    status: String(row.status ?? "draft") as MarketingWorkflow["status"],
    nodes,
    nodeCount: Number(row.nodeCount ?? row.node_count ?? nodes.length),
    runCount: Number(row.runCount ?? row.run_count ?? 0),
    createdAt: String(row.createdAt ?? row.created_at ?? ""),
    updatedAt: String(row.updatedAt ?? row.updated_at ?? ""),
  };
}

function parseWorkflows(payload: unknown): MarketingWorkflow[] {
  const workflows = unwrap<unknown[]>(payload, "workflows");
  return Array.isArray(workflows) ? workflows.map(parseWorkflow) : [];
}

function parseWorkflowNodes(payload: unknown): MarketingWorkflowNode[] {
  const nodes = unwrap<unknown[]>(payload, "nodes");
  return Array.isArray(nodes)
    ? nodes.map(parseWorkflowNode).sort((a, b) => a.position - b.position)
    : [];
}

function parseWorkflowRuns(payload: unknown): MarketingWorkflowRun[] {
  const runs = unwrap<unknown[]>(payload, "runs");
  if (!Array.isArray(runs)) return [];
  return runs.map((value) => {
    const row = asRecord(value);
    const contact = asRecord(row.contact);
    const context = asRecord(row.context);
    const currentStep = row.currentStep ?? row.current_step ?? row.currentNodePosition ?? row.current_node_position;
    return {
      id: String(row.id ?? ""),
      workflowId: String(row.workflowId ?? row.workflow_id ?? ""),
      contactId: typeof row.contactId === "string"
        ? row.contactId
        : typeof row.contact_id === "string" ? row.contact_id : null,
      contactName: typeof row.contactName === "string"
        ? row.contactName
        : typeof contact.name === "string"
          ? contact.name
          : typeof context.contactName === "string" ? context.contactName : null,
      contactEmail: typeof row.contactEmail === "string"
        ? row.contactEmail
        : typeof row.contact_email === "string"
          ? row.contact_email
          : typeof contact.email === "string"
            ? contact.email
            : typeof context.contactEmail === "string" ? context.contactEmail : null,
      status: String(row.status ?? "active") as MarketingWorkflowRun["status"],
      currentStep: typeof (currentStep ?? row.currentPosition ?? row.current_position) === "number"
        ? Number(currentStep ?? row.currentPosition ?? row.current_position)
        : null,
      nextRunAt: typeof row.nextRunAt === "string"
        ? row.nextRunAt
        : typeof row.next_run_at === "string" ? row.next_run_at : null,
      createdAt: String(row.createdAt ?? row.created_at ?? ""),
      updatedAt: String(row.updatedAt ?? row.updated_at ?? ""),
    };
  });
}

export function createMarketingUiClient(
  basePath = "/api/marketing",
  fetcher: typeof fetch = fetch,
): MarketingUiClient {
  const root = basePath.replace(/\/$/, "");
  const endpoint = (path: string) => `${root}/${path}`;
  const json = (method: string, body?: unknown): RequestInit => ({
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const campaignAction = async (campaignId: string, action: string, body?: unknown) =>
    parseCampaign(
      await readPayload(
        await fetcher(
          endpoint(`campaigns/${encodeURIComponent(campaignId)}/${action}`),
          json("POST", body),
        ),
      ),
    );
  const workflowAction = async (workflowId: string, action: "activate" | "pause") =>
    parseWorkflow(
      await readPayload(
        await fetcher(
          endpoint(`workflows/${encodeURIComponent(workflowId)}/${action}`),
          json("POST"),
        ),
      ),
    );

  return {
    async listCampaigns() {
      return parseCampaigns(await readPayload(await fetcher(endpoint("campaigns"))));
    },
    async getCampaign(campaignId) {
      return parseCampaign(
        await readPayload(await fetcher(endpoint(`campaigns/${encodeURIComponent(campaignId)}`))),
      );
    },
    async createCampaign(input: MarketingCampaignInput) {
      return parseCampaign(
        await readPayload(await fetcher(endpoint("campaigns"), json("POST", input))),
      );
    },
    async updateCampaign(campaignId, input) {
      return parseCampaign(
        await readPayload(
          await fetcher(
            endpoint(`campaigns/${encodeURIComponent(campaignId)}`),
            json("PATCH", input),
          ),
        ),
      );
    },
    async deleteCampaign(campaignId) {
      await readPayload(
        await fetcher(
          endpoint(`campaigns/${encodeURIComponent(campaignId)}`),
          json("DELETE"),
        ),
      );
    },
    sendCampaign(campaignId) {
      return campaignAction(campaignId, "send");
    },
    scheduleCampaign(campaignId, scheduledAt) {
      return campaignAction(campaignId, "schedule", { scheduledAt });
    },
    cancelCampaign(campaignId) {
      return campaignAction(campaignId, "cancel");
    },
    retryCampaign(campaignId) {
      return campaignAction(campaignId, "retry");
    },
    async sendTest(campaignId, email) {
      await readPayload(
        await fetcher(
          endpoint(`campaigns/${encodeURIComponent(campaignId)}/test`),
          json("POST", { email }),
        ),
      );
    },
    async listRecipients(campaignId) {
      return parseRecipients(
        await readPayload(
          await fetcher(endpoint(`campaigns/${encodeURIComponent(campaignId)}/recipients`)),
        ),
      );
    },
    async listTopics() {
      return parseTopics(await readPayload(await fetcher(endpoint("topics"))));
    },
    async listSegments() {
      return parseSegments(await readPayload(await fetcher(endpoint("segments"))));
    },
    async getSegment(segmentId) {
      return parseSegment(
        await readPayload(await fetcher(endpoint(`segments/${encodeURIComponent(segmentId)}`))),
      );
    },
    async createSegment(input: MarketingSegmentInput) {
      return parseSegment(
        await readPayload(await fetcher(endpoint("segments"), json("POST", input))),
      );
    },
    async updateSegment(segmentId, input) {
      return parseSegment(
        await readPayload(
          await fetcher(
            endpoint(`segments/${encodeURIComponent(segmentId)}`),
            json("PATCH", input),
          ),
        ),
      );
    },
    async deleteSegment(segmentId) {
      const response = await fetcher(
        endpoint(`segments/${encodeURIComponent(segmentId)}`),
        json("DELETE"),
      );
      if (!response.ok) await readPayload(response);
    },
    async previewSegment(rule, limit = 8, segmentId) {
      return await readPayload(
        await fetcher(
          endpoint(segmentId
            ? `segments/${encodeURIComponent(segmentId)}/preview`
            : "segments/preview"),
          json("POST", { rule, limit }),
        ),
      ) as MarketingSegmentPreview;
    },
    async getOverview(sinceDays) {
      const query = typeof sinceDays === "number" ? `?sinceDays=${sinceDays}` : "";
      return await readPayload(
        await fetcher(endpoint(`analytics/overview${query}`)),
      ) as MarketingOverviewMetrics;
    },
    async getCampaignAnalytics(campaignId) {
      return await readPayload(
        await fetcher(endpoint(`analytics/campaigns/${encodeURIComponent(campaignId)}`)),
      ) as MarketingCampaignAnalytics;
    },
    async getSegmentAnalytics(segmentId) {
      return await readPayload(
        await fetcher(endpoint(`analytics/segments/${encodeURIComponent(segmentId)}`)),
      ) as MarketingSegmentAnalytics;
    },
    async listWorkflows() {
      return parseWorkflows(await readPayload(await fetcher(endpoint("workflows"))));
    },
    async getWorkflow(workflowId) {
      return parseWorkflow(
        await readPayload(await fetcher(endpoint(`workflows/${encodeURIComponent(workflowId)}`))),
      );
    },
    async createWorkflow(input: MarketingWorkflowInput) {
      return parseWorkflow(
        await readPayload(await fetcher(endpoint("workflows"), json("POST", input))),
      );
    },
    async updateWorkflow(workflowId, input) {
      return parseWorkflow(
        await readPayload(
          await fetcher(
            endpoint(`workflows/${encodeURIComponent(workflowId)}`),
            json("PATCH", input),
          ),
        ),
      );
    },
    async deleteWorkflow(workflowId) {
      const response = await fetcher(
        endpoint(`workflows/${encodeURIComponent(workflowId)}`),
        json("DELETE"),
      );
      if (!response.ok) await readPayload(response);
    },
    activateWorkflow(workflowId) {
      return workflowAction(workflowId, "activate");
    },
    pauseWorkflow(workflowId) {
      return workflowAction(workflowId, "pause");
    },
    async saveWorkflowNodes(workflowId, nodes: MarketingWorkflowNodeInput[]) {
      return parseWorkflowNodes(
        await readPayload(
          await fetcher(
            endpoint(`workflows/${encodeURIComponent(workflowId)}/nodes`),
            json("PUT", { nodes }),
          ),
        ),
      );
    },
    async listWorkflowRuns(workflowId) {
      return parseWorkflowRuns(
        await readPayload(
          await fetcher(endpoint(`workflows/${encodeURIComponent(workflowId)}/runs`)),
        ),
      );
    },
  };
}
