import type { ReactNode } from "react";

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
  status: "queued" | "sending" | "sent" | "failed" | "suppressed";
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
