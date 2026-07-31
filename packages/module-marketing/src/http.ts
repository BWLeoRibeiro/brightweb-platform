import { timingSafeEqual } from "node:crypto";
import {
  publicError,
  sanitizePublicError,
} from "@brightweblabs/infra/robustness";
import type {
  createTopic,
  listTopics,
  reorderTopics,
  resolveByUnsubscribeToken,
  updateTopic,
  unsubscribeAll,
  unsubscribeTopic,
} from "./server";
import type {
  cancelCampaign,
  createCampaign,
  deleteCampaign,
  getCampaign,
  listCampaignRecipients,
  listCampaigns,
  retryCampaignFailures,
  scheduleCampaign,
  sendCampaignNow,
  sendTestEmail,
  updateCampaign,
} from "./campaigns";
import type { MarketingEmailSender } from "./email/types";
import type { runMarketingWorker } from "./worker";
import type { processResendWebhook } from "./webhooks";
import type {
  createSegment,
  deleteSegment,
  getSegment,
  listSegments,
  previewSegment,
  updateSegment,
} from "./segments";
import type {
  getCampaignAnalytics,
  getMarketingOverview,
  getSegmentAnalytics,
} from "./analytics";
import type {
  activateWorkflow,
  createWorkflow,
  deleteWorkflow,
  deleteWorkflowNode,
  getWorkflow,
  listWorkflowRuns,
  listWorkflows,
  pauseWorkflow,
  updateWorkflow,
  upsertWorkflowNodes,
} from "./workflows";

type RouteContext = {
  params: Promise<{ token: string }> | { token: string };
};

type MarketingHttpDependencies = {
  createServiceClient: () => unknown;
  resolveToken: typeof resolveByUnsubscribeToken;
  unsubscribeAll: typeof unsubscribeAll;
  unsubscribeTopic: typeof unsubscribeTopic;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function secretsMatch(expected: string, provided: string) {
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length
    && timingSafeEqual(expectedBuffer, providedBuffer);
}

function json(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}

async function tokenFromRequest(request: Request, context?: RouteContext) {
  const contextToken = context ? (await context.params).token : null;
  if (contextToken) return contextToken.trim();
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  return decodeURIComponent(segments.at(-1) ?? "").trim();
}

function publicResult(
  result: NonNullable<Awaited<ReturnType<typeof resolveByUnsubscribeToken>>>,
) {
  return {
    email: result.email,
    subscriptions: result.subscriptions,
  };
}

function marketingErrorResponse(error: unknown, context: string) {
  const message = error instanceof Error ? error.message : "";
  if (
    message.includes("required")
    || message.includes("must be")
    || message.startsWith("Only ")
    || message.startsWith("Pause ")
    || message.startsWith("A workflow ")
    || message.startsWith("Workflow node ")
    || message.startsWith("This campaign")
    || message.startsWith("A valid email")
  ) {
    return json(publicError("INVALID_INPUT", message), { status: 400 });
  }
  if (message === "Campaign not found.") {
    return json(publicError("CAMPAIGN_NOT_FOUND", message), { status: 404 });
  }
  if (message === "Workflow not found.") {
    return json(publicError("WORKFLOW_NOT_FOUND", message), { status: 404 });
  }
  if (message === "Topic not found.") {
    return json(publicError("TOPIC_NOT_FOUND", message), { status: 404 });
  }
  if (message === "Topic slug already exists.") {
    return json(publicError("TOPIC_SLUG_CONFLICT", message), { status: 409 });
  }
  return json(
    sanitizePublicError(
      error,
      {},
      "The marketing preference request could not be completed.",
      context,
    ),
    { status: 500 },
  );
}

export function createMarketingUnsubscribeGetHandler(
  dependencies: MarketingHttpDependencies,
) {
  return async (request: Request, context?: RouteContext) => {
    const token = await tokenFromRequest(request, context);
    if (!UUID_PATTERN.test(token)) {
      return json(publicError("INVALID_TOKEN", "The unsubscribe token is invalid."), {
        status: 400,
      });
    }
    try {
      const result = await dependencies.resolveToken(
        dependencies.createServiceClient() as never,
        token,
      );
      return result
        ? json(publicResult(result))
        : json(publicError("TOKEN_NOT_FOUND", "The unsubscribe token was not found."), {
          status: 404,
        });
    } catch (error) {
      return marketingErrorResponse(error, "marketing.unsubscribe.get");
    }
  };
}

type ServerUserAccess =
  | {
    ok: true;
    supabase: unknown;
    profileId?: string;
    role?: string | null;
  }
  | { ok: false; status: number; error: string };

type CampaignRouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export type MarketingCampaignHttpDependencies = {
  getAccess: () => Promise<ServerUserAccess>;
  createServiceClient: () => unknown;
  sender: MarketingEmailSender;
  workerSecret: string;
  webhookSecret: string;
  publicAppUrl?: string | null;
  listTopics: typeof listTopics;
  reorderTopics?: typeof reorderTopics;
  createTopic: typeof createTopic;
  updateTopic: typeof updateTopic;
  listCampaigns: typeof listCampaigns;
  getCampaign: typeof getCampaign;
  createCampaign: typeof createCampaign;
  updateCampaign: typeof updateCampaign;
  deleteCampaign: typeof deleteCampaign;
  listRecipients: typeof listCampaignRecipients;
  scheduleCampaign: typeof scheduleCampaign;
  cancelCampaign: typeof cancelCampaign;
  sendCampaignNow: typeof sendCampaignNow;
  retryCampaignFailures: typeof retryCampaignFailures;
  sendTestEmail: typeof sendTestEmail;
  runWorker: typeof runMarketingWorker;
  processWebhook: typeof processResendWebhook;
  listSegments: typeof listSegments;
  getSegment: typeof getSegment;
  createSegment: typeof createSegment;
  updateSegment: typeof updateSegment;
  deleteSegment: typeof deleteSegment;
  previewSegment: typeof previewSegment;
  getMarketingOverview: typeof getMarketingOverview;
  getCampaignAnalytics: typeof getCampaignAnalytics;
  getSegmentAnalytics: typeof getSegmentAnalytics;
  listWorkflows: typeof listWorkflows;
  getWorkflow: typeof getWorkflow;
  createWorkflow: typeof createWorkflow;
  updateWorkflow: typeof updateWorkflow;
  deleteWorkflow: typeof deleteWorkflow;
  activateWorkflow: typeof activateWorkflow;
  pauseWorkflow: typeof pauseWorkflow;
  upsertWorkflowNodes: typeof upsertWorkflowNodes;
  deleteWorkflowNode: typeof deleteWorkflowNode;
  listWorkflowRuns: typeof listWorkflowRuns;
  logger?: Pick<Console, "error">;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function parseJsonObject(request: Request) {
  try {
    const value = await request.json();
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

async function campaignId(context?: CampaignRouteContext) {
  return context ? (await context.params).id : "";
}

async function requireStaff(
  dependencies: MarketingCampaignHttpDependencies,
): Promise<Response | Extract<ServerUserAccess, { ok: true }>> {
  const access = await dependencies.getAccess();
  if (!access.ok) {
    return json(publicError("ACCESS_DENIED", access.error), { status: access.status });
  }
  if (access.role !== "staff" && access.role !== "admin") {
    return json(publicError("FORBIDDEN", "Forbidden."), { status: 403 });
  }
  return access;
}

function isResponse(value: Response | object): value is Response {
  return value instanceof Response;
}

function withStaff(
  dependencies: MarketingCampaignHttpDependencies,
  contextName: string,
  action: (
    serviceClient: unknown,
    access: Extract<ServerUserAccess, { ok: true }>,
    request: Request,
    context?: CampaignRouteContext,
  ) => Promise<Response>,
) {
  return async (request: Request, context?: CampaignRouteContext) => {
    const access = await requireStaff(dependencies);
    if (isResponse(access)) return access;
    try {
      return await action(
        dependencies.createServiceClient(),
        access,
        request,
        context,
      );
    } catch (error) {
      return marketingErrorResponse(error, contextName);
    }
  };
}

function campaignInput(payload: Record<string, unknown>) {
  return {
    ...(typeof payload.name === "string" ? { name: payload.name } : {}),
    ...(typeof payload.subject === "string" ? { subject: payload.subject } : {}),
    ...(typeof payload.topicId === "string" ? { topicId: payload.topicId } : {}),
    ...("segmentId" in payload ? {
      segmentId: typeof payload.segmentId === "string" ? payload.segmentId : null,
    } : {}),
    ...("preheader" in payload ? {
      preheader: typeof payload.preheader === "string" ? payload.preheader : null,
    } : {}),
    ...("fromName" in payload ? {
      fromName: typeof payload.fromName === "string" ? payload.fromName : null,
    } : {}),
    ...("fromEmail" in payload ? {
      fromEmail: typeof payload.fromEmail === "string" ? payload.fromEmail : null,
    } : {}),
    ...("bodyHtml" in payload ? {
      bodyHtml: typeof payload.bodyHtml === "string" ? payload.bodyHtml : null,
    } : {}),
    ...("bodyText" in payload ? {
      bodyText: typeof payload.bodyText === "string" ? payload.bodyText : null,
    } : {}),
    ...("bodyJson" in payload ? { bodyJson: payload.bodyJson } : {}),
    ...(typeof payload.batchSize === "number" ? { batchSize: payload.batchSize } : {}),
    ...("ratePerMinute" in payload ? {
      ratePerMinute: typeof payload.ratePerMinute === "number"
        ? payload.ratePerMinute
        : null,
    } : {}),
  };
}

export function createMarketingCampaignHttpHandlers(
  dependencies: MarketingCampaignHttpDependencies,
) {
  const topicsGet = withStaff(
    dependencies,
    "marketing.topics.list",
    async (supabase) => json(await dependencies.listTopics(supabase as never)),
  );
  const topicsPost = withStaff(
    dependencies,
    "marketing.topics.create",
    async (supabase, _access, request) => {
      const payload = await parseJsonObject(request);
      if (!payload || typeof payload.slug !== "string" || typeof payload.label !== "string") {
        return json(publicError("INVALID_INPUT", "Topic slug and label are required."), { status: 400 });
      }
      return json(await dependencies.createTopic(supabase as never, {
        slug: payload.slug,
        label: payload.label,
        description: typeof payload.description === "string" ? payload.description : null,
        position: typeof payload.position === "number" ? payload.position : undefined,
      }), { status: 201 });
    },
  );
  const topicsOrderPost = withStaff(
    dependencies,
    "marketing.topics.reorder",
    async (supabase, _access, request) => {
      const payload = await parseJsonObject(request);
      if (!payload || !Array.isArray(payload.topicIds)
        || !payload.topicIds.every((id) => typeof id === "string" && id.length > 0)) {
        return json(publicError("INVALID_INPUT", "A valid topic order is required."), { status: 400 });
      }
      if (!dependencies.reorderTopics) {
        return json(publicError("NOT_IMPLEMENTED", "Topic reordering is not available."), { status: 501 });
      }
      return json(await dependencies.reorderTopics(supabase as never, payload.topicIds));
    },
  );
  const topicPatch = withStaff(
    dependencies,
    "marketing.topics.update",
    async (supabase, _access, request, context) => {
      const payload = await parseJsonObject(request);
      if (!payload) {
        return json(publicError("INVALID_INPUT", "A topic update is required."), { status: 400 });
      }
      const hasUpdate = typeof payload.label === "string"
        || payload.description === null
        || typeof payload.description === "string"
        || typeof payload.isActive === "boolean"
        || typeof payload.position === "number";
      if (!hasUpdate) {
        return json(publicError("INVALID_INPUT", "A valid topic update is required."), { status: 400 });
      }
      const result = await dependencies.updateTopic(
        supabase as never,
        await campaignId(context),
        {
          ...(typeof payload.label === "string" ? { label: payload.label } : {}),
          ...(payload.description === null || typeof payload.description === "string"
            ? { description: payload.description }
            : {}),
          ...(typeof payload.isActive === "boolean" ? { isActive: payload.isActive } : {}),
          ...(typeof payload.position === "number" ? { position: payload.position } : {}),
        },
      );
      return json(result);
    },
  );
  const segmentsGet = withStaff(
    dependencies,
    "marketing.segments.list",
    async (supabase) => json(await dependencies.listSegments(supabase as never)),
  );
  const segmentsPost = withStaff(
    dependencies,
    "marketing.segments.create",
    async (supabase, access, request) => {
      const payload = await parseJsonObject(request);
      if (!payload || typeof payload.name !== "string") {
        return json(publicError("INVALID_INPUT", "Segment name is required."), {
          status: 400,
        });
      }
      return json(await dependencies.createSegment(supabase as never, {
        name: payload.name,
        description: typeof payload.description === "string"
          ? payload.description
          : null,
        rule: isRecord(payload.rule) ? payload.rule : {},
        createdByProfileId: access.profileId ?? null,
      } as never), { status: 201 });
    },
  );
  const segmentGet = withStaff(
    dependencies,
    "marketing.segments.get",
    async (supabase, _access, _request, context) => {
      const result = await dependencies.getSegment(
        supabase as never,
        await campaignId(context),
      );
      return result
        ? json(result)
        : json(publicError("SEGMENT_NOT_FOUND", "Segment not found."), { status: 404 });
    },
  );
  const segmentPatch = withStaff(
    dependencies,
    "marketing.segments.update",
    async (supabase, _access, request, context) => {
      const payload = await parseJsonObject(request);
      if (!payload) {
        return json(publicError("INVALID_INPUT", "A JSON object is required."), {
          status: 400,
        });
      }
      return json(await dependencies.updateSegment(
        supabase as never,
        await campaignId(context),
        {
          ...(typeof payload.name === "string" ? { name: payload.name } : {}),
          ...("description" in payload ? {
            description: typeof payload.description === "string"
              ? payload.description
              : null,
          } : {}),
          ...(isRecord(payload.rule) ? { rule: payload.rule } : {}),
        } as never,
      ));
    },
  );
  const segmentDelete = withStaff(
    dependencies,
    "marketing.segments.delete",
    async (supabase, _access, _request, context) => {
      await dependencies.deleteSegment(supabase as never, await campaignId(context));
      return new Response(null, { status: 204 });
    },
  );
  const segmentPreviewPost = withStaff(
    dependencies,
    "marketing.segments.preview",
    async (supabase, _access, request, context) => {
      const payload = await parseJsonObject(request);
      if (!payload) {
        return json(publicError("INVALID_INPUT", "A JSON object is required."), {
          status: 400,
        });
      }
      const segmentId = await campaignId(context);
      const segment = segmentId
        ? await dependencies.getSegment(supabase as never, segmentId)
        : null;
      const rule = isRecord(payload.rule) ? payload.rule : segment?.rule;
      if (!rule) {
        return json(publicError("INVALID_INPUT", "A segment rule is required."), {
          status: 400,
        });
      }
      const limit = typeof payload.limit === "number" ? payload.limit : 8;
      return json(await dependencies.previewSegment(
        supabase as never,
        rule,
        { limit },
      ));
    },
  );
  const campaignsGet = withStaff(
    dependencies,
    "marketing.campaigns.list",
    async (supabase) => json(await dependencies.listCampaigns(supabase as never)),
  );
  const campaignsPost = withStaff(
    dependencies,
    "marketing.campaigns.create",
    async (supabase, access, request) => {
      const payload = await parseJsonObject(request);
      if (!payload) {
        return json(publicError("INVALID_INPUT", "A JSON object is required."), {
          status: 400,
        });
      }
      const input = {
        ...campaignInput(payload),
        createdByProfileId: access.profileId ?? null,
      };
      if (!("name" in input) || !("subject" in input) || !("topicId" in input)) {
        return json(
          publicError("INVALID_INPUT", "Campaign name, subject, and topic are required."),
          { status: 400 },
        );
      }
      return json(await dependencies.createCampaign(supabase as never, input as never), {
        status: 201,
      });
    },
  );
  const campaignGet = withStaff(
    dependencies,
    "marketing.campaigns.get",
    async (supabase, _access, _request, context) => {
      const result = await dependencies.getCampaign(
        supabase as never,
        await campaignId(context),
      );
      return result
        ? json(result)
        : json(publicError("CAMPAIGN_NOT_FOUND", "Campaign not found."), { status: 404 });
    },
  );
  const campaignPatch = withStaff(
    dependencies,
    "marketing.campaigns.update",
    async (supabase, _access, request, context) => {
      const payload = await parseJsonObject(request);
      if (!payload) {
        return json(publicError("INVALID_INPUT", "A JSON object is required."), {
          status: 400,
        });
      }
      return json(await dependencies.updateCampaign(
        supabase as never,
        await campaignId(context),
        campaignInput(payload),
      ));
    },
  );
  const campaignDelete = withStaff(
    dependencies,
    "marketing.campaigns.delete",
    async (supabase, _access, _request, context) => {
      await dependencies.deleteCampaign(supabase as never, await campaignId(context));
      return new Response(null, { status: 204 });
    },
  );
  const recipientsGet = withStaff(
    dependencies,
    "marketing.campaigns.recipients",
    async (supabase, _access, _request, context) => json(
      await dependencies.listRecipients(supabase as never, await campaignId(context)),
    ),
  );
  const schedulePost = withStaff(
    dependencies,
    "marketing.campaigns.schedule",
    async (supabase, _access, request, context) => {
      const payload = await parseJsonObject(request);
      if (!payload || typeof payload.scheduledAt !== "string") {
        return json(
          publicError("INVALID_INPUT", "scheduledAt is required."),
          { status: 400 },
        );
      }
      return json(await dependencies.scheduleCampaign(
        supabase as never,
        await campaignId(context),
        payload.scheduledAt,
      ));
    },
  );
  const cancelPost = withStaff(
    dependencies,
    "marketing.campaigns.cancel",
    async (supabase, _access, _request, context) => json(
      await dependencies.cancelCampaign(supabase as never, await campaignId(context)),
    ),
  );
  const sendPost = withStaff(
    dependencies,
    "marketing.campaigns.send",
    async (supabase, _access, _request, context) => {
      const campaign = await dependencies.sendCampaignNow(
        supabase as never,
        await campaignId(context),
      );
      void dependencies.runWorker({
        supabase,
        sender: dependencies.sender,
        publicAppUrl: dependencies.publicAppUrl,
      }).catch((error) => {
        (dependencies.logger ?? console).error(
          "[marketing] Inline worker failed.",
          error,
        );
      });
      return json(campaign, { status: 202 });
    },
  );
  const retryPost = withStaff(
    dependencies,
    "marketing.campaigns.retry",
    async (supabase, _access, _request, context) => {
      const campaign = await dependencies.retryCampaignFailures(
        supabase as never,
        await campaignId(context),
      );
      void dependencies.runWorker({
        supabase,
        sender: dependencies.sender,
        publicAppUrl: dependencies.publicAppUrl,
      }).catch((error) => {
        (dependencies.logger ?? console).error(
          "[marketing] Inline retry worker failed.",
          error,
        );
      });
      return json(campaign, { status: 202 });
    },
  );
  const testPost = withStaff(
    dependencies,
    "marketing.campaigns.test",
    async (supabase, _access, request, context) => {
      const payload = await parseJsonObject(request);
      if (!payload || typeof payload.toEmail !== "string") {
        return json(publicError("INVALID_INPUT", "toEmail is required."), {
          status: 400,
        });
      }
      const result = await dependencies.sendTestEmail(
        supabase as never,
        await campaignId(context),
        payload.toEmail,
        dependencies.sender,
      );
      return json(result, { status: result.ok ? 200 : 502 });
    },
  );
  const analyticsOverviewGet = withStaff(
    dependencies,
    "marketing.analytics.overview",
    async (supabase, _access, request) => {
      const rawSinceDays = new URL(request.url).searchParams.get("sinceDays");
      const sinceDays = rawSinceDays === null ? undefined : Number(rawSinceDays);
      if (
        sinceDays !== undefined
        && (!Number.isInteger(sinceDays) || sinceDays < 1 || sinceDays > 3_650)
      ) {
        return json(
          publicError("INVALID_INPUT", "sinceDays must be an integer between 1 and 3650."),
          { status: 400 },
        );
      }
      return json(await dependencies.getMarketingOverview(
        supabase as never,
        { sinceDays },
      ));
    },
  );
  const analyticsCampaignGet = withStaff(
    dependencies,
    "marketing.analytics.campaign",
    async (supabase, _access, _request, context) => json(
      await dependencies.getCampaignAnalytics(
        supabase as never,
        await campaignId(context),
      ),
    ),
  );
  const analyticsSegmentGet = withStaff(
    dependencies,
    "marketing.analytics.segment",
    async (supabase, _access, _request, context) => json(
      await dependencies.getSegmentAnalytics(
        supabase as never,
        await campaignId(context),
      ),
    ),
  );
  const workflowsGet = withStaff(
    dependencies,
    "marketing.workflows.list",
    async (supabase) => json(await dependencies.listWorkflows(supabase)),
  );
  const workflowsPost = withStaff(
    dependencies,
    "marketing.workflows.create",
    async (supabase, access, request) => {
      const payload = await parseJsonObject(request);
      if (
        !payload
        || typeof payload.name !== "string"
        || typeof payload.triggerType !== "string"
      ) {
        return json(
          publicError("INVALID_INPUT", "Workflow name and triggerType are required."),
          { status: 400 },
        );
      }
      return json(await dependencies.createWorkflow(supabase, {
        name: payload.name,
        description: typeof payload.description === "string"
          ? payload.description
          : null,
        triggerType: payload.triggerType as never,
        triggerConfig: isRecord(payload.triggerConfig) ? payload.triggerConfig : {},
        createdByProfileId: access.profileId ?? null,
      }), { status: 201 });
    },
  );
  const workflowGet = withStaff(
    dependencies,
    "marketing.workflows.get",
    async (supabase, _access, _request, context) => {
      const workflow = await dependencies.getWorkflow(
        supabase,
        await campaignId(context),
      );
      return workflow
        ? json(workflow)
        : json(publicError("WORKFLOW_NOT_FOUND", "Workflow not found."), {
          status: 404,
        });
    },
  );
  const workflowPatch = withStaff(
    dependencies,
    "marketing.workflows.update",
    async (supabase, _access, request, context) => {
      const payload = await parseJsonObject(request);
      if (!payload) {
        return json(publicError("INVALID_INPUT", "A JSON object is required."), {
          status: 400,
        });
      }
      return json(await dependencies.updateWorkflow(
        supabase,
        await campaignId(context),
        {
          ...(typeof payload.name === "string" ? { name: payload.name } : {}),
          ...("description" in payload ? {
            description: typeof payload.description === "string"
              ? payload.description
              : null,
          } : {}),
          ...(typeof payload.triggerType === "string"
            ? { triggerType: payload.triggerType as never }
            : {}),
          ...(isRecord(payload.triggerConfig)
            ? { triggerConfig: payload.triggerConfig }
            : {}),
        },
      ));
    },
  );
  const workflowDelete = withStaff(
    dependencies,
    "marketing.workflows.delete",
    async (supabase, _access, _request, context) => {
      await dependencies.deleteWorkflow(supabase, await campaignId(context));
      return new Response(null, { status: 204 });
    },
  );
  const workflowActivatePost = withStaff(
    dependencies,
    "marketing.workflows.activate",
    async (supabase, _access, _request, context) => json(
      await dependencies.activateWorkflow(supabase, await campaignId(context)),
    ),
  );
  const workflowPausePost = withStaff(
    dependencies,
    "marketing.workflows.pause",
    async (supabase, _access, _request, context) => json(
      await dependencies.pauseWorkflow(supabase, await campaignId(context)),
    ),
  );
  const workflowNodesPut = withStaff(
    dependencies,
    "marketing.workflows.nodes.upsert",
    async (supabase, _access, request, context) => {
      const payload = await parseJsonObject(request);
      if (!payload || !Array.isArray(payload.nodes)) {
        return json(publicError("INVALID_INPUT", "nodes must be an array."), {
          status: 400,
        });
      }
      const nodes = payload.nodes.map((value, position) => {
        if (!isRecord(value) || typeof value.nodeType !== "string") {
          throw new Error("Workflow node nodeType is required.");
        }
        return {
          ...(typeof value.id === "string" ? { id: value.id } : {}),
          position: typeof value.position === "number" ? value.position : position,
          nodeType: value.nodeType as never,
          config: isRecord(value.config) ? value.config : {},
        };
      });
      return json(await dependencies.upsertWorkflowNodes(
        supabase,
        await campaignId(context),
        nodes,
      ));
    },
  );
  const workflowNodeDelete = withStaff(
    dependencies,
    "marketing.workflows.nodes.delete",
    async (supabase, _access, _request, context) => {
      const params = context ? await context.params : { id: "" };
      const nodeId = "nodeId" in params && typeof params.nodeId === "string"
        ? params.nodeId
        : "";
      if (!nodeId) {
        return json(publicError("INVALID_INPUT", "Node ID is required."), {
          status: 400,
        });
      }
      return json(await dependencies.deleteWorkflowNode(
        supabase,
        params.id,
        nodeId,
      ));
    },
  );
  const workflowRunsGet = withStaff(
    dependencies,
    "marketing.workflows.runs.list",
    async (supabase, _access, _request, context) => json(
      await dependencies.listWorkflowRuns(supabase, await campaignId(context)),
    ),
  );

  const workerPost = async (request: Request) => {
    const authorization = request.headers.get("authorization") ?? "";
    const expectedAuthorization = `Bearer ${dependencies.workerSecret}`;
    if (
      !dependencies.workerSecret
      || !secretsMatch(expectedAuthorization, authorization)
    ) {
      return json(publicError("UNAUTHORIZED", "Unauthorized."), { status: 401 });
    }
    try {
      return json(await dependencies.runWorker({
        supabase: dependencies.createServiceClient(),
        sender: dependencies.sender,
        publicAppUrl: dependencies.publicAppUrl,
      }));
    } catch (error) {
      return marketingErrorResponse(error, "marketing.worker");
    }
  };

  const webhookPost = async (request: Request) => {
    try {
      const result = await dependencies.processWebhook(
        dependencies.createServiceClient() as never,
        await request.text(),
        request.headers,
        dependencies.webhookSecret,
      );
      return json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (
        message.toLowerCase().includes("signature")
        || message.toLowerCase().includes("secret")
      ) {
        return json(publicError("INVALID_WEBHOOK", "Invalid webhook signature."), {
          status: 400,
        });
      }
      return marketingErrorResponse(error, "marketing.webhooks.resend");
    }
  };

  return {
    topicsGet,
    topicsPost,
    topicsOrderPost,
    topicPatch,
    segmentsGet,
    segmentsPost,
    segmentGet,
    segmentPatch,
    segmentDelete,
    segmentPreviewPost,
    campaignsGet,
    campaignsPost,
    campaignGet,
    campaignPatch,
    campaignDelete,
    recipientsGet,
    schedulePost,
    cancelPost,
    sendPost,
    retryPost,
    testPost,
    analyticsOverviewGet,
    analyticsCampaignGet,
    analyticsSegmentGet,
    workflowsGet,
    workflowsPost,
    workflowGet,
    workflowPatch,
    workflowDelete,
    workflowActivatePost,
    workflowPausePost,
    workflowNodesPut,
    workflowNodeDelete,
    workflowRunsGet,
    workerPost,
    webhookPost,
  };
}

export function createMarketingUnsubscribePostHandler(
  dependencies: MarketingHttpDependencies,
) {
  return async (request: Request, context?: RouteContext) => {
    const token = await tokenFromRequest(request, context);
    if (!UUID_PATTERN.test(token)) {
      return json(publicError("INVALID_TOKEN", "The unsubscribe token is invalid."), {
        status: 400,
      });
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      payload = {};
    }
    if (
      typeof payload !== "object"
      || payload === null
      || Array.isArray(payload)
    ) {
      return json(publicError("INVALID_INPUT", "The request body must be a JSON object."), {
        status: 400,
      });
    }
    const topicId = (payload as { topicId?: unknown }).topicId;
    if (topicId != null && (typeof topicId !== "string" || !UUID_PATTERN.test(topicId))) {
      return json(publicError("INVALID_TOPIC", "The topic ID is invalid."), {
        status: 400,
      });
    }

    try {
      const serviceClient = dependencies.createServiceClient();
      const result = typeof topicId === "string"
        ? await dependencies.unsubscribeTopic(serviceClient as never, token, topicId)
        : await dependencies.unsubscribeAll(serviceClient as never, token);
      return result
        ? json(publicResult(result))
        : json(publicError("TOKEN_NOT_FOUND", "The unsubscribe token was not found."), {
          status: 404,
        });
    } catch (error) {
      return marketingErrorResponse(error, "marketing.unsubscribe.post");
    }
  };
}
