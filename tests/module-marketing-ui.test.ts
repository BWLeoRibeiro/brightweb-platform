import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { createMarketingCampaignHttpHandlers } from "../packages/module-marketing/src/http.ts";
import { createMarketingUiClient } from "../packages/module-marketing/src/ui/client.ts";

const campaign = {
  id: "campaign/1",
  name: "Launch",
  subject: "Hello",
  preheader: null,
  bodyHtml: "<p>Hello</p>",
  bodyText: null,
  fromName: null,
  fromEmail: null,
  topicId: "topic-1",
  segmentId: null,
  status: "draft",
  scheduledAt: null,
  sentAt: null,
  totalRecipients: 1,
  sentCount: 0,
  failedCount: 0,
  createdAt: "2026-07-26T10:00:00.000Z",
  updatedAt: "2026-07-26T10:00:00.000Z",
} as const;

const topic = {
  id: "topic-1",
  slug: "news",
  label: "News",
  description: null,
  isActive: true,
  position: 0,
  createdAt: "2026-07-26T10:00:00.000Z",
  updatedAt: "2026-07-26T10:00:00.000Z",
};

const segment = {
  id: "segment/1",
  name: "Readers",
  description: null,
  rule: {},
  createdByProfileId: "profile-1",
  createdAt: "2026-07-26T10:00:00.000Z",
  updatedAt: "2026-07-26T10:00:00.000Z",
};

const workflow = {
  id: "workflow/1",
  name: "Welcome",
  description: null,
  triggerType: "contact_subscribed",
  triggerConfig: { topic: "news" },
  status: "draft",
  nodes: [],
  nodeCount: 0,
  runCount: 0,
  createdAt: "2026-07-26T10:00:00.000Z",
  updatedAt: "2026-07-26T10:00:00.000Z",
};

const metrics = {
  sent: 1,
  delivered: 1,
  opened: 1,
  clicked: 0,
  unsubscribed: 0,
  bounced: 0,
  complained: 0,
  openRate: 100,
  clickRate: 0,
  bounceRate: 0,
  unsubRate: 0,
  complaintRate: 0,
  rawEventTotals: {
    sent: 1,
    delivered: 1,
    opened: 1,
    clicked: 0,
    unsubscribed: 0,
    bounced: 0,
    complained: 0,
  },
};

const queue = {
  queued: 0,
  sending: 0,
  sent: 1,
  failed: 0,
  suppressed: 0,
  skipped: 0,
};

test("marketing editors distinguish pending, unavailable, and fulfilled-empty collections", () => {
  const campaignSource = readFileSync(join(process.cwd(), "packages/module-marketing/src/ui/marketing-client.tsx"), "utf8");
  const workflowSource = readFileSync(join(process.cwd(), "packages/module-marketing/src/ui/workflow-workspace.tsx"), "utf8");
  const segmentSource = readFileSync(join(process.cwd(), "packages/module-marketing/src/ui/segment-workspace.tsx"), "utf8");

  assert.match(campaignSource, /setRecipientsLoadState\("pending"\)[\s\S]*setEditorOpen\(true\)/);
  assert.match(campaignSource, /loadState === "pending"[\s\S]*loadState === "rejected"[\s\S]*recipients\.length === 0/);
  assert.match(campaignSource, /generation !== campaignLoadGeneration\.current/);

  assert.match(workflowSource, /setRunsLoadState\("pending"\)[\s\S]*setOpen\(true\)/);
  assert.match(workflowSource, /runsLoadState === "pending"[\s\S]*runsLoadState === "rejected"[\s\S]*runs\.length === 0/);
  assert.match(workflowSource, /generation !== workflowLoadGeneration\.current/);

  assert.match(segmentSource, /setPreviewLoadState\("pending"\)[\s\S]*window\.setTimeout/);
  assert.match(segmentSource, /previewLoadState === "pending" && !previewHasData[\s\S]*previewLoadState === "rejected" && !previewHasData[\s\S]*preview\.sample\.length === 0/);
});

test("marketing collection controls use registered actions and authoritative queries", () => {
  const toolbarSource = readFileSync(join(process.cwd(), "packages/module-marketing/src/ui/toolbar-controls.tsx"), "utf8");
  const clientSource = readFileSync(join(process.cwd(), "packages/module-marketing/src/ui/marketing-client.tsx"), "utf8");
  const registrationSource = readFileSync(join(process.cwd(), "packages/module-marketing/src/registration.ts"), "utf8");

  assert.match(
    clientSource,
    /initialLoadedViewsRef\.current\.delete\(collectionView\)[\s\S]*setCollectionLoading\(false\);[\s\S]*return;/,
  );

  assert.match(toolbarSource, /useShellActionsReady/);
  assert.match(toolbarSource, /disabled=\{!ready\}/);
  assert.match(toolbarSource, /Procurar campanhas/);
  assert.match(toolbarSource, /Limpar/);
  assert.match(toolbarSource, /Aplicar/);
  assert.match(clientSource, /useShellAction[\s\S]*MARKETING_EVENTS\.setSearch/);
  assert.match(clientSource, /window\.setTimeout[\s\S]*180/);
  assert.match(clientSource, /client\.queryCampaigns/);
  assert.match(clientSource, /client\.querySegments/);
  assert.match(clientSource, /client\.queryWorkflows/);
  assert.match(registrationSource, /surface: "marketing"[\s\S]*exact: \["\/marketing"\]/);
});

test("marketing UI client methods match the exported HTTP handler contract", async () => {
  const dependencyCalls: Array<[string, unknown]> = [];
  const dependencies = {
    getAccess: async () => ({
      ok: true,
      supabase: { kind: "user-client" },
      profileId: "profile-1",
      role: "admin",
    }),
    createServiceClient: () => ({ kind: "service-client" }),
    sender: {},
    workerSecret: "worker-secret",
    webhookSecret: "webhook-secret",
    publicAppUrl: "https://example.test",
    listTopics: async () => [topic],
    createTopic: async (_client: unknown, input: unknown) => {
      dependencyCalls.push(["createTopic", input]);
      return topic;
    },
    updateTopic: async (_client: unknown, id: string, input: unknown) => {
      dependencyCalls.push(["updateTopic", { id, input }]);
      return topic;
    },
    listCampaigns: async () => [campaign],
    getCampaign: async (_client: unknown, id: string) => {
      dependencyCalls.push(["getCampaign", id]);
      return campaign;
    },
    createCampaign: async (_client: unknown, input: unknown) => {
      dependencyCalls.push(["createCampaign", input]);
      return campaign;
    },
    updateCampaign: async (_client: unknown, id: string, input: unknown) => {
      dependencyCalls.push(["updateCampaign", { id, input }]);
      return campaign;
    },
    deleteCampaign: async (_client: unknown, id: string) => {
      dependencyCalls.push(["deleteCampaign", id]);
    },
    listRecipients: async (_client: unknown, id: string) => {
      dependencyCalls.push(["listRecipients", id]);
      return [{
        id: "recipient-1",
        contact_id: "contact-1",
        email: "reader@example.com",
        status: "sent",
        error: null,
        sent_at: "2026-07-26T10:00:00.000Z",
      }];
    },
    scheduleCampaign: async (_client: unknown, id: string, scheduledAt: string) => {
      dependencyCalls.push(["scheduleCampaign", { id, scheduledAt }]);
      return campaign;
    },
    cancelCampaign: async (_client: unknown, id: string) => {
      dependencyCalls.push(["cancelCampaign", id]);
      return campaign;
    },
    sendCampaignNow: async (_client: unknown, id: string) => {
      dependencyCalls.push(["sendCampaignNow", id]);
      return campaign;
    },
    retryCampaignFailures: async (_client: unknown, id: string) => {
      dependencyCalls.push(["retryCampaignFailures", id]);
      return campaign;
    },
    sendTestEmail: async (
      _client: unknown,
      id: string,
      toEmail: string,
    ) => {
      dependencyCalls.push(["sendTestEmail", { id, toEmail }]);
      return { ok: true, id: "message-1" };
    },
    runWorker: async () => ({ processed: 0 }),
    processWebhook: async () => ({ ok: true }),
    listSegments: async () => [segment],
    getSegment: async (_client: unknown, id: string) => {
      dependencyCalls.push(["getSegment", id]);
      return segment;
    },
    createSegment: async (_client: unknown, input: unknown) => {
      dependencyCalls.push(["createSegment", input]);
      return segment;
    },
    updateSegment: async (_client: unknown, id: string, input: unknown) => {
      dependencyCalls.push(["updateSegment", { id, input }]);
      return segment;
    },
    deleteSegment: async (_client: unknown, id: string) => {
      dependencyCalls.push(["deleteSegment", id]);
    },
    previewSegment: async (_client: unknown, rule: unknown, options: unknown) => {
      dependencyCalls.push(["previewSegment", { rule, options }]);
      return {
        count: 1,
        sample: [{ id: "contact-1", email: "reader@example.com", name: "Reader" }],
      };
    },
    getMarketingOverview: async (_client: unknown, options: unknown) => {
      dependencyCalls.push(["getMarketingOverview", options]);
      return metrics;
    },
    getCampaignAnalytics: async (_client: unknown, id: string) => {
      dependencyCalls.push(["getCampaignAnalytics", id]);
      return { campaignId: id, ...metrics, queue };
    },
    getSegmentAnalytics: async (_client: unknown, id: string) => {
      dependencyCalls.push(["getSegmentAnalytics", id]);
      return { segmentId: id, campaignCount: 1, ...metrics, queue };
    },
    listWorkflows: async () => [workflow],
    getWorkflow: async (_client: unknown, id: string) => {
      dependencyCalls.push(["getWorkflow", id]);
      return workflow;
    },
    createWorkflow: async (_client: unknown, input: unknown) => {
      dependencyCalls.push(["createWorkflow", input]);
      return workflow;
    },
    updateWorkflow: async (_client: unknown, id: string, input: unknown) => {
      dependencyCalls.push(["updateWorkflow", { id, input }]);
      return workflow;
    },
    deleteWorkflow: async (_client: unknown, id: string) => {
      dependencyCalls.push(["deleteWorkflow", id]);
    },
    activateWorkflow: async (_client: unknown, id: string) => {
      dependencyCalls.push(["activateWorkflow", id]);
      return workflow;
    },
    pauseWorkflow: async (_client: unknown, id: string) => {
      dependencyCalls.push(["pauseWorkflow", id]);
      return workflow;
    },
    upsertWorkflowNodes: async (_client: unknown, id: string, nodes: unknown) => {
      dependencyCalls.push(["upsertWorkflowNodes", { id, nodes }]);
      return [{
        id: "node-1",
        workflow_id: id,
        node_type: "wait",
        position: 0,
        config: { duration: 1, unit: "days" },
      }];
    },
    deleteWorkflowNode: async () => null,
    listWorkflowRuns: async (_client: unknown, id: string) => {
      dependencyCalls.push(["listWorkflowRuns", id]);
      return [{
        id: "run-1",
        workflow_id: id,
        contact_id: "contact-1",
        contact: { name: "Reader", email: "reader@example.com" },
        status: "active",
        current_node_position: 0,
        next_run_at: null,
        created_at: "2026-07-26T10:00:00.000Z",
        updated_at: "2026-07-26T10:00:00.000Z",
      }];
    },
  };
  const handlers = createMarketingCampaignHttpHandlers(dependencies as never);
  const requests: string[] = [];

  const fetcher = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = new URL(
      input instanceof Request ? input.url : input.toString(),
      "https://example.test",
    );
    const request = new Request(url, init);
    const method = request.method;
    const route = url.pathname.replace(/^\/api\/marketing\/?/, "");
    requests.push(`${method} /${route}${url.search}`);
    const parts = route.split("/").filter(Boolean);
    const id = parts[1] ? decodeURIComponent(parts[1]) : "";
    const context = { params: { id } };

    if (method === "GET" && route === "topics") return handlers.topicsGet(request);
    if (method === "POST" && route === "topics") return handlers.topicsPost(request);
    if (parts[0] === "topics" && parts.length === 2 && method === "PATCH") {
      return handlers.topicPatch(request, context);
    }
    if (route === "campaigns" && method === "GET") return handlers.campaignsGet(request);
    if (route === "campaigns" && method === "POST") return handlers.campaignsPost(request);
    if (parts[0] === "campaigns" && parts.length === 2 && method === "GET") {
      return handlers.campaignGet(request, context);
    }
    if (parts[0] === "campaigns" && parts.length === 2 && method === "PATCH") {
      return handlers.campaignPatch(request, context);
    }
    if (parts[0] === "campaigns" && parts.length === 2 && method === "DELETE") {
      return handlers.campaignDelete(request, context);
    }
    if (parts[0] === "campaigns" && parts[2] === "recipients" && method === "GET") {
      return handlers.recipientsGet(request, context);
    }
    if (parts[0] === "campaigns" && parts[2] === "schedule" && method === "POST") {
      return handlers.schedulePost(request, context);
    }
    if (parts[0] === "campaigns" && parts[2] === "cancel" && method === "POST") {
      return handlers.cancelPost(request, context);
    }
    if (parts[0] === "campaigns" && parts[2] === "send" && method === "POST") {
      return handlers.sendPost(request, context);
    }
    if (parts[0] === "campaigns" && parts[2] === "retry" && method === "POST") {
      return handlers.retryPost(request, context);
    }
    if (parts[0] === "campaigns" && parts[2] === "test" && method === "POST") {
      return handlers.testPost(request, context);
    }
    if (route === "segments" && method === "GET") return handlers.segmentsGet(request);
    if (route === "segments" && method === "POST") return handlers.segmentsPost(request);
    if (route === "segments/preview" && method === "POST") {
      return handlers.segmentPreviewPost(request);
    }
    if (parts[0] === "segments" && parts[2] === "preview" && method === "POST") {
      return handlers.segmentPreviewPost(request, context);
    }
    if (parts[0] === "segments" && parts.length === 2 && method === "GET") {
      return handlers.segmentGet(request, context);
    }
    if (parts[0] === "segments" && parts.length === 2 && method === "PATCH") {
      return handlers.segmentPatch(request, context);
    }
    if (parts[0] === "segments" && parts.length === 2 && method === "DELETE") {
      return handlers.segmentDelete(request, context);
    }
    if (route === "analytics/overview" && method === "GET") {
      return handlers.analyticsOverviewGet(request);
    }
    if (parts[0] === "analytics" && parts[1] === "campaigns" && method === "GET") {
      return handlers.analyticsCampaignGet(request, { params: { id: decodeURIComponent(parts[2] ?? "") } });
    }
    if (parts[0] === "analytics" && parts[1] === "segments" && method === "GET") {
      return handlers.analyticsSegmentGet(request, { params: { id: decodeURIComponent(parts[2] ?? "") } });
    }
    if (route === "workflows" && method === "GET") return handlers.workflowsGet(request);
    if (route === "workflows" && method === "POST") return handlers.workflowsPost(request);
    if (parts[0] === "workflows" && parts.length === 2 && method === "GET") {
      return handlers.workflowGet(request, context);
    }
    if (parts[0] === "workflows" && parts.length === 2 && method === "PATCH") {
      return handlers.workflowPatch(request, context);
    }
    if (parts[0] === "workflows" && parts.length === 2 && method === "DELETE") {
      return handlers.workflowDelete(request, context);
    }
    if (parts[0] === "workflows" && parts[2] === "activate" && method === "POST") {
      return handlers.workflowActivatePost(request, context);
    }
    if (parts[0] === "workflows" && parts[2] === "pause" && method === "POST") {
      return handlers.workflowPausePost(request, context);
    }
    if (parts[0] === "workflows" && parts[2] === "nodes" && method === "PUT") {
      return handlers.workflowNodesPut(request, context);
    }
    if (parts[0] === "workflows" && parts[2] === "runs" && method === "GET") {
      return handlers.workflowRunsGet(request, context);
    }
    throw new Error(`No handler for ${method} ${route}`);
  }) as typeof fetch;

  const client = createMarketingUiClient("/api/marketing/", fetcher);
  const campaignInput = {
    name: campaign.name,
    subject: campaign.subject,
    bodyHtml: campaign.bodyHtml,
    topicId: campaign.topicId,
  };
  const segmentInput = { name: segment.name, rule: segment.rule };
  const workflowInput = {
    name: workflow.name,
    triggerType: workflow.triggerType,
    triggerConfig: workflow.triggerConfig,
  };

  assert.equal((await client.listCampaigns())[0]?.id, campaign.id);
  assert.equal((await client.queryCampaigns({ page: 2, pageSize: 20, search: "launch", status: "draft" })).items[0]?.id, campaign.id);
  assert.equal((await client.getCampaign(campaign.id)).id, campaign.id);
  assert.equal((await client.createCampaign(campaignInput)).id, campaign.id);
  assert.equal((await client.updateCampaign(campaign.id, { subject: "Updated" })).id, campaign.id);
  await client.deleteCampaign(campaign.id);
  assert.equal((await client.sendCampaign(campaign.id)).id, campaign.id);
  assert.equal((await client.scheduleCampaign(campaign.id, "2026-07-27T10:00:00.000Z")).id, campaign.id);
  assert.equal((await client.cancelCampaign(campaign.id)).id, campaign.id);
  assert.equal((await client.retryCampaign(campaign.id)).id, campaign.id);
  await client.sendTest(campaign.id, "test@example.com");
  assert.equal((await client.listRecipients(campaign.id))[0]?.contactId, "contact-1");
  assert.equal((await client.listTopics())[0]?.id, topic.id);
  assert.equal((await client.createTopic({ slug: "news", label: "News" })).id, topic.id);
  assert.equal((await client.updateTopic(topic.id, { label: "Notícias" })).id, topic.id);
  assert.equal((await client.listSegments())[0]?.id, segment.id);
  assert.equal((await client.querySegments({ page: 1, pageSize: 20, search: "readers" })).items[0]?.id, segment.id);
  assert.equal((await client.getSegment(segment.id)).id, segment.id);
  assert.equal((await client.createSegment(segmentInput)).id, segment.id);
  assert.equal((await client.updateSegment(segment.id, { description: "Updated" })).id, segment.id);
  await client.deleteSegment(segment.id);
  assert.equal((await client.previewSegment({}, 3)).count, 1);
  assert.equal((await client.previewSegment({}, 4, segment.id)).count, 1);
  assert.equal((await client.getOverview(30)).sent, 1);
  assert.equal((await client.getCampaignAnalytics(campaign.id)).campaignId, campaign.id);
  assert.equal((await client.getSegmentAnalytics(segment.id)).segmentId, segment.id);
  assert.equal((await client.listWorkflows())[0]?.id, workflow.id);
  assert.equal((await client.queryWorkflows({ page: 1, pageSize: 20, search: "welcome", status: "active" })).items[0]?.id, workflow.id);
  assert.equal((await client.getWorkflow(workflow.id)).id, workflow.id);
  assert.equal((await client.createWorkflow(workflowInput)).id, workflow.id);
  assert.equal((await client.updateWorkflow(workflow.id, { description: "Updated" })).id, workflow.id);
  await client.deleteWorkflow(workflow.id);
  assert.equal((await client.activateWorkflow(workflow.id)).id, workflow.id);
  assert.equal((await client.pauseWorkflow(workflow.id)).id, workflow.id);
  const savedNodes = await client.saveWorkflowNodes(workflow.id, [{
    nodeType: "wait",
    position: 0,
    config: { duration: 1, unit: "days" },
  }]);
  assert.deepEqual(savedNodes[0], {
    id: "node-1",
    workflowId: workflow.id,
    type: "wait",
    position: 0,
    config: { duration: 1, unit: "days" },
    createdAt: undefined,
    updatedAt: undefined,
  });
  assert.equal((await client.listWorkflowRuns(workflow.id))[0]?.contactName, "Reader");

  assert.deepEqual(requests, [
    "GET /campaigns",
    "GET /campaigns?page=2&pageSize=20&search=launch&status=draft",
    "GET /campaigns/campaign%2F1",
    "POST /campaigns",
    "PATCH /campaigns/campaign%2F1",
    "DELETE /campaigns/campaign%2F1",
    "POST /campaigns/campaign%2F1/send",
    "POST /campaigns/campaign%2F1/schedule",
    "POST /campaigns/campaign%2F1/cancel",
    "POST /campaigns/campaign%2F1/retry",
    "POST /campaigns/campaign%2F1/test",
    "GET /campaigns/campaign%2F1/recipients",
    "GET /topics",
    "POST /topics",
    "PATCH /topics/topic-1",
    "GET /segments",
    "GET /segments?page=1&pageSize=20&search=readers",
    "GET /segments/segment%2F1",
    "POST /segments",
    "PATCH /segments/segment%2F1",
    "DELETE /segments/segment%2F1",
    "POST /segments/preview",
    "POST /segments/segment%2F1/preview",
    "GET /analytics/overview?sinceDays=30",
    "GET /analytics/campaigns/campaign%2F1",
    "GET /analytics/segments/segment%2F1",
    "GET /workflows",
    "GET /workflows?page=1&pageSize=20&search=welcome&status=active",
    "GET /workflows/workflow%2F1",
    "POST /workflows",
    "PATCH /workflows/workflow%2F1",
    "DELETE /workflows/workflow%2F1",
    "POST /workflows/workflow%2F1/activate",
    "POST /workflows/workflow%2F1/pause",
    "PUT /workflows/workflow%2F1/nodes",
    "GET /workflows/workflow%2F1/runs",
  ]);
  assert.ok(dependencyCalls.some(([name, value]) => (
    name === "sendTestEmail"
    && JSON.stringify(value) === JSON.stringify({
      id: campaign.id,
      toEmail: "test@example.com",
    })
  )));
  assert.ok(dependencyCalls.some(([name, value]) => (
    name === "getMarketingOverview"
    && JSON.stringify(value) === JSON.stringify({ sinceDays: 30 })
  )));
});
