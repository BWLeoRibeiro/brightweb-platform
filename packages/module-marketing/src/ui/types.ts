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

export type MarketingTopic = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  isActive: boolean;
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

export type MarketingUiClient = {
  listCampaigns(): Promise<MarketingCampaign[]>;
  getCampaign(campaignId: string): Promise<MarketingCampaign>;
  createCampaign(input: MarketingCampaignInput): Promise<MarketingCampaign>;
  updateCampaign(campaignId: string, input: Partial<MarketingCampaignInput>): Promise<MarketingCampaign>;
  deleteCampaign(campaignId: string): Promise<void>;
  sendCampaign(campaignId: string): Promise<MarketingCampaign>;
  scheduleCampaign(campaignId: string, scheduledAt: string): Promise<MarketingCampaign>;
  cancelCampaign(campaignId: string): Promise<MarketingCampaign>;
  retryCampaign(campaignId: string): Promise<MarketingCampaign>;
  sendTest(campaignId: string, email: string): Promise<void>;
  listRecipients(campaignId: string): Promise<MarketingCampaignRecipient[]>;
  listTopics(): Promise<MarketingTopic[]>;
  listSegments(): Promise<MarketingSegment[]>;
  getSegment(segmentId: string): Promise<MarketingSegment>;
  createSegment(input: MarketingSegmentInput): Promise<MarketingSegment>;
  updateSegment(segmentId: string, input: Partial<MarketingSegmentInput>): Promise<MarketingSegment>;
  deleteSegment(segmentId: string): Promise<void>;
  previewSegment(rule: MarketingSegmentRule, limit?: number, segmentId?: string): Promise<MarketingSegmentPreview>;
  getOverview(sinceDays?: number): Promise<MarketingOverviewMetrics>;
  getCampaignAnalytics(campaignId: string): Promise<MarketingCampaignAnalytics>;
  getSegmentAnalytics(segmentId: string): Promise<MarketingSegmentAnalytics>;
};

export type MarketingUiDictionary = {
  locale: "pt-PT";
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
  };
  list: {
    title: string;
    subject: string;
    topic: string;
    recipients: string;
    created: string;
    noSubject: string;
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
