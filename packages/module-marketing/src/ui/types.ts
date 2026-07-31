import type { ReactNode } from "react";
import type { MarketingSegmentRule } from "../segments";
import type {
  MarketingCampaignAnalytics,
  MarketingOverviewMetrics,
  MarketingSegmentAnalytics,
} from "../analytics";

export type MarketingCampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "canceled"
  | "failed";

export type MarketingCollectionResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type MarketingCollectionQuery<TStatus extends string = never> = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: TStatus | null;
};

export type MarketingTopic = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  isActive: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type MarketingTopicInput = {
  slug: string;
  label: string;
  description?: string | null;
  position?: number;
};

export type MarketingTopicUpdate = Partial<
  Pick<MarketingTopicInput, "label" | "description" | "position">
> & {
  isActive?: boolean;
};

export type MarketingCampaign = {
  id: string;
  name: string;
  subject: string;
  preheader: string | null;
  bodyHtml: string | null;
  bodyText: string | null;
  fromName: string | null;
  fromEmail: string | null;
  topicId: string;
  segmentId: string | null;
  topic?: MarketingTopic | null;
  status: MarketingCampaignStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
};

export type MarketingCampaignRecipient = {
  id: string;
  contactId: string | null;
  email: string;
  status: "queued" | "sending" | "sent" | "failed" | "suppressed" | "skipped";
  error: string | null;
  sentAt: string | null;
};

export type MarketingCampaignInput = {
  name: string;
  subject: string;
  preheader?: string | null;
  bodyHtml: string;
  fromName?: string | null;
  fromEmail?: string | null;
  topicId: string;
  segmentId?: string | null;
};

export type MarketingSegment = {
  id: string;
  name: string;
  description: string | null;
  rule: MarketingSegmentRule;
  createdByProfileId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MarketingSegmentInput = {
  name: string;
  description?: string | null;
  rule: MarketingSegmentRule;
};

export type MarketingSegmentPreview = {
  count: number;
  sample: Array<{ id: string; email: string; name: string }>;
};

export type MarketingWorkflowStatus = "draft" | "active" | "paused";

export type MarketingWorkflowTriggerType =
  | "contact_subscribed"
  | "crm_status_changed"
  | "project_status_changed"
  | "form_submitted";

export type MarketingWorkflowNodeType = "send_email" | "wait" | "add_tag";

export type MarketingWorkflowTriggerConfig = Record<string, unknown>;

export type MarketingWorkflowNode = {
  id: string;
  workflowId: string;
  type: MarketingWorkflowNodeType;
  position: number;
  config: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export type MarketingWorkflowNodeInput = {
  id?: string;
  nodeType: MarketingWorkflowNodeType;
  position: number;
  config: Record<string, unknown>;
};

export type MarketingWorkflow = {
  id: string;
  name: string;
  description: string | null;
  triggerType: MarketingWorkflowTriggerType;
  triggerConfig: MarketingWorkflowTriggerConfig;
  status: MarketingWorkflowStatus;
  nodes: MarketingWorkflowNode[];
  nodeCount: number;
  runCount: number;
  countsKnown?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MarketingWorkflowInput = {
  name: string;
  description?: string | null;
  triggerType: MarketingWorkflowTriggerType;
  triggerConfig?: MarketingWorkflowTriggerConfig;
};

export type MarketingWorkflowRun = {
  id: string;
  workflowId: string;
  contactId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  status: "active" | "completed" | "failed" | "canceled";
  currentStep: number | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MarketingUiClient = {
  listCampaigns(options?: MarketingRequestOptions): Promise<MarketingCampaign[]>;
  queryCampaigns?(query?: MarketingCollectionQuery<MarketingCampaignStatus>, options?: MarketingRequestOptions): Promise<MarketingCollectionResult<MarketingCampaign>>;
  getCampaign(campaignId: string, options?: MarketingRequestOptions): Promise<MarketingCampaign>;
  createCampaign(input: MarketingCampaignInput): Promise<MarketingCampaign>;
  updateCampaign(campaignId: string, input: Partial<MarketingCampaignInput>): Promise<MarketingCampaign>;
  deleteCampaign(campaignId: string): Promise<void>;
  sendCampaign(campaignId: string): Promise<MarketingCampaign>;
  scheduleCampaign(campaignId: string, scheduledAt: string): Promise<MarketingCampaign>;
  cancelCampaign(campaignId: string): Promise<MarketingCampaign>;
  retryCampaign(campaignId: string): Promise<MarketingCampaign>;
  sendTest(campaignId: string, email: string): Promise<void>;
  listRecipients(campaignId: string, options?: MarketingRequestOptions): Promise<MarketingCampaignRecipient[]>;
  listTopics(options?: MarketingRequestOptions): Promise<MarketingTopic[]>;
  createTopic(input: MarketingTopicInput): Promise<MarketingTopic>;
  updateTopic(topicId: string, input: MarketingTopicUpdate): Promise<MarketingTopic>;
  reorderTopics?(topicIds: string[]): Promise<MarketingTopic[]>;
  listSegments(options?: MarketingRequestOptions): Promise<MarketingSegment[]>;
  querySegments?(query?: MarketingCollectionQuery, options?: MarketingRequestOptions): Promise<MarketingCollectionResult<MarketingSegment>>;
  getSegment(segmentId: string, options?: MarketingRequestOptions): Promise<MarketingSegment>;
  createSegment(input: MarketingSegmentInput): Promise<MarketingSegment>;
  updateSegment(segmentId: string, input: Partial<MarketingSegmentInput>): Promise<MarketingSegment>;
  deleteSegment(segmentId: string): Promise<void>;
  previewSegment(rule: MarketingSegmentRule, limit?: number, segmentId?: string, options?: MarketingRequestOptions): Promise<MarketingSegmentPreview>;
  getOverview(sinceDays?: number, options?: MarketingRequestOptions): Promise<MarketingOverviewMetrics>;
  getCampaignAnalytics(campaignId: string, options?: MarketingRequestOptions): Promise<MarketingCampaignAnalytics>;
  getSegmentAnalytics(segmentId: string, options?: MarketingRequestOptions): Promise<MarketingSegmentAnalytics>;
  listWorkflows(options?: MarketingRequestOptions): Promise<MarketingWorkflow[]>;
  queryWorkflows?(query?: MarketingCollectionQuery<MarketingWorkflowStatus>, options?: MarketingRequestOptions): Promise<MarketingCollectionResult<MarketingWorkflow>>;
  getWorkflow(workflowId: string, options?: MarketingRequestOptions): Promise<MarketingWorkflow>;
  createWorkflow(input: MarketingWorkflowInput): Promise<MarketingWorkflow>;
  updateWorkflow(workflowId: string, input: Partial<MarketingWorkflowInput>): Promise<MarketingWorkflow>;
  deleteWorkflow(workflowId: string): Promise<void>;
  activateWorkflow(workflowId: string): Promise<MarketingWorkflow>;
  pauseWorkflow(workflowId: string): Promise<MarketingWorkflow>;
  saveWorkflowNodes(workflowId: string, nodes: MarketingWorkflowNodeInput[]): Promise<MarketingWorkflowNode[]>;
  listWorkflowRuns(workflowId: string, options?: MarketingRequestOptions): Promise<MarketingWorkflowRun[]>;
};

export type MarketingRequestOptions = { signal?: AbortSignal };

export type MarketingUiDictionary = {
  locale: "pt-PT";
  workflows: {
    tab: string;
    eyebrow: string;
    title: string;
    subtitle: string;
    newWorkflow: string;
    emptyTitle: string;
    emptyDescription: string;
    nodeCount: (count: number) => string;
    runCount: (count: number) => string;
    statuses: Record<MarketingWorkflowStatus, string>;
    triggers: Record<MarketingWorkflowTriggerType, string>;
    triggerConfig: {
      topic: string;
      targetStatus: string;
      form: string;
      topicPlaceholder: string;
      statusPlaceholder: string;
      formPlaceholder: string;
    };
    editorCreate: string;
    editorEdit: string;
    fields: {
      name: string;
      description: string;
      triggerType: string;
    };
    placeholders: {
      name: string;
      description: string;
    };
    steps: {
      title: string;
      subtitle: string;
      add: string;
      empty: string;
      step: (position: number) => string;
      types: Record<MarketingWorkflowNodeType, string>;
      moveUp: string;
      moveDown: string;
      remove: string;
      subject: string;
      body: string;
      topic: string;
      tag: string;
      duration: string;
      unit: string;
      units: {
        minutes: string;
        hours: string;
        days: string;
      };
      placeholders: {
        subject: string;
        body: string;
        topic: string;
        tag: string;
      };
    };
    runs: {
      title: string;
      subtitle: string;
      empty: string;
      contact: string;
      status: string;
      currentStep: string;
      nextRun: string;
      statuses: Record<MarketingWorkflowRun["status"], string>;
    };
    save: string;
    saving: string;
    activate: string;
    pause: string;
    delete: string;
    close: string;
    created: string;
    saved: string;
    deleted: string;
    activated: string;
    paused: string;
    nodesSaved: string;
  };
  page: {
    eyebrow: string;
    title: string;
    subtitle: string;
    newCampaign: string;
    emptyTitle: string;
    emptyDescription: string;
    loadError: string;
    campaignsTab: string;
    segmentsTab: string;
    analyticsTab: string;
    topicsTab?: string;
  };
  topics?: {
    eyebrow: string;
    title: string;
    subtitle: string;
    newTopic: string;
    emptyTitle: string;
    emptyDescription: string;
    fields: {
      label: string;
      slug: string;
      description: string;
    };
    placeholders: {
      label: string;
      slug: string;
      description: string;
    };
    active: string;
    inactive: string;
    activate: string;
    deactivate: string;
    edit: string;
    moveUp: string;
    moveDown: string;
    save: string;
    cancel: string;
    created: string;
    saved: string;
  };
  analytics: {
    eyebrow: string;
    title: string;
    subtitle: string;
    sent: string;
    delivered: string;
    openRate: string;
    clickRate: string;
    bounced: string;
    unsubscribed: string;
    campaignsTitle: string;
    campaign: string;
    delivery: string;
    opens: string;
    clicks: string;
    queue: string;
    noData: string;
    detailsTitle: string;
    detailsSubtitle: string;
    campaignCount: (count: number) => string;
    queueInProgress: (count: number) => string;
    queueFailed: (count: number) => string;
    queueExcluded: (count: number) => string;
    queueCompleted: (count: number) => string;
    open: string;
    openCampaign: (name: string) => string;
  };
  list: {
    title: string;
    subject: string;
    topic: string;
    recipients: string;
    created: string;
    noSubject: string;
    campaignCount: (count: number) => string;
  };
  editor: {
    createEyebrow: string;
    editEyebrow: string;
    newTitle: string;
    fields: {
      name: string;
      subject: string;
      preheader: string;
      fromName: string;
      fromEmail: string;
      topic: string;
      segment: string;
      body: string;
      scheduleAt: string;
      testEmail: string;
    };
    placeholders: {
      name: string;
      subject: string;
      preheader: string;
      fromName: string;
      fromEmail: string;
      topic: string;
      segment: string;
      body: string;
      testEmail: string;
    };
    personalization: string;
    personalizationHint: string;
    tokens: Record<string, string>;
    save: string;
    saving: string;
    sendNow: string;
    schedule: string;
    cancel: string;
    retry: string;
    sendTest: string;
    close: string;
    effectiveAudience: string;
    safeHtml: string;
  };
  segments: {
    eyebrow: string;
    title: string;
    subtitle: string;
    newSegment: string;
    emptyTitle: string;
    emptyDescription: string;
    editorCreate: string;
    editorEdit: string;
    fields: {
      name: string;
      description: string;
      topics: string;
      preferredLanguage: string;
      createdAfter: string;
      createdBefore: string;
      engagedWithinDays: string;
      engagementType: string;
      excludeSuppressed: string;
    };
    placeholders: {
      name: string;
      description: string;
      preferredLanguage: string;
      engagedWithinDays: string;
    };
    anyTopicHint: string;
    engagementTypes: { any: string; opened: string; clicked: string };
    previewTitle: string;
    previewCount: string;
    previewEmpty: string;
    previewLoading: string;
    topicCount: (count: number) => string;
    save: string;
    delete: string;
    close: string;
    created: string;
    saved: string;
    deleted: string;
  };
  recipients: {
    title: string;
    subtitle: string;
    empty: string;
    statuses: Record<MarketingCampaignRecipient["status"], string>;
  };
  statuses: Record<MarketingCampaignStatus, string>;
  feedback: {
    created: string;
    saved: string;
    sent: string;
    scheduled: string;
    canceled: string;
    retried: string;
    testSent: string;
    required: string;
    genericError: string;
  };
};

export type MarketingUiProviderProps = {
  children: ReactNode;
  client?: MarketingUiClient;
};
