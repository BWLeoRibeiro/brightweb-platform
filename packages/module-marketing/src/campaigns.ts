import type { MarketingEmailSender } from "./email/types";
import { resolveSegmentContacts } from "./segments";
import { isSuppressed } from "./server";

type QueryClient = {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

const QUERY_PAGE_SIZE = 1_000;
const QUERY_CHUNK_SIZE = 200;

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "canceled"
  | "failed";

export type MarketingCampaignListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: CampaignStatus | null;
};

export type MarketingCampaignListResult = {
  items: MarketingCampaign[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type MarketingCampaign = {
  id: string;
  name: string;
  subject: string;
  preheader: string | null;
  fromName: string | null;
  fromEmail: string | null;
  topicId: string;
  segmentId: string | null;
  bodyHtml: string | null;
  bodyText: string | null;
  bodyJson: unknown;
  status: CampaignStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  batchSize: number;
  ratePerMinute: number | null;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  createdByProfileId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateCampaignInput = {
  name: string;
  subject: string;
  topicId: string;
  segmentId?: string | null;
  preheader?: string | null;
  fromName?: string | null;
  fromEmail?: string | null;
  bodyHtml?: string | null;
  bodyText?: string | null;
  bodyJson?: unknown;
  batchSize?: number;
  ratePerMinute?: number | null;
  createdByProfileId?: string | null;
};

export type UpdateCampaignInput = Partial<
  Omit<CreateCampaignInput, "createdByProfileId">
>;

type CampaignRow = {
  id: string;
  name: string;
  subject: string;
  preheader: string | null;
  from_name: string | null;
  from_email: string | null;
  topic_id: string;
  segment_id: string | null;
  body_html: string | null;
  body_text: string | null;
  body_json: unknown;
  status: CampaignStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  batch_size: number;
  rate_per_minute: number | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_by_profile_id: string | null;
  created_at: string;
  updated_at: string;
};

const CAMPAIGN_COLUMNS =
  "id,name,subject,preheader,from_name,from_email,topic_id,segment_id,body_html,body_text,body_json,status,scheduled_at,sent_at,batch_size,rate_per_minute,total_recipients,sent_count,failed_count,created_by_profile_id,created_at,updated_at";

function db(supabase: unknown) {
  return supabase as QueryClient;
}

function throwIfError(error: { message?: string } | null | undefined) {
  if (error) throw new Error(error.message || "Marketing campaign request failed.");
}

function chunks<T>(values: T[], size = QUERY_CHUNK_SIZE): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function collectPages<T>(createQuery: () => any): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; ; start += QUERY_PAGE_SIZE) {
    const result = await createQuery().range(start, start + QUERY_PAGE_SIZE - 1);
    throwIfError(result.error);
    const page = (result.data ?? []) as T[];
    rows.push(...page);
    if (page.length < QUERY_PAGE_SIZE) return rows;
  }
}

function fromRow(row: CampaignRow): MarketingCampaign {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    preheader: row.preheader,
    fromName: row.from_name,
    fromEmail: row.from_email,
    topicId: row.topic_id,
    segmentId: row.segment_id,
    bodyHtml: row.body_html,
    bodyText: row.body_text,
    bodyJson: row.body_json,
    status: row.status,
    scheduledAt: row.scheduled_at,
    sentAt: row.sent_at,
    batchSize: row.batch_size,
    ratePerMinute: row.rate_per_minute,
    totalRecipients: row.total_recipients,
    sentCount: row.sent_count,
    failedCount: row.failed_count,
    createdByProfileId: row.created_by_profile_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateCampaignInput(input: CreateCampaignInput | UpdateCampaignInput) {
  if ("name" in input && !input.name?.trim()) {
    throw new Error("Campaign name is required.");
  }
  if ("subject" in input && !input.subject?.trim()) {
    throw new Error("Campaign subject is required.");
  }
  if ("batchSize" in input && input.batchSize != null && (
    !Number.isInteger(input.batchSize) || input.batchSize < 1 || input.batchSize > 1000
  )) {
    throw new Error("Campaign batch size must be between 1 and 1000.");
  }
  if ("ratePerMinute" in input && input.ratePerMinute != null && (
    !Number.isInteger(input.ratePerMinute) || input.ratePerMinute < 1
  )) {
    throw new Error("Campaign rate per minute must be positive.");
  }
}

function payloadFromInput(input: CreateCampaignInput | UpdateCampaignInput) {
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name.trim();
  if (input.subject !== undefined) payload.subject = input.subject.trim();
  if (input.preheader !== undefined) payload.preheader = input.preheader;
  if (input.fromName !== undefined) payload.from_name = input.fromName;
  if (input.fromEmail !== undefined) payload.from_email = input.fromEmail;
  if (input.topicId !== undefined) payload.topic_id = input.topicId;
  if (input.segmentId !== undefined) payload.segment_id = input.segmentId;
  if (input.bodyHtml !== undefined) payload.body_html = input.bodyHtml;
  if (input.bodyText !== undefined) payload.body_text = input.bodyText;
  if (input.bodyJson !== undefined) payload.body_json = input.bodyJson;
  if (input.batchSize !== undefined) payload.batch_size = input.batchSize;
  if (input.ratePerMinute !== undefined) payload.rate_per_minute = input.ratePerMinute;
  if ("createdByProfileId" in input && input.createdByProfileId !== undefined) {
    payload.created_by_profile_id = input.createdByProfileId;
  }
  return payload;
}

export async function listCampaigns(supabase: unknown): Promise<MarketingCampaign[]> {
  const { data, error } = await db(supabase)
    .from("marketing_campaigns")
    .select(CAMPAIGN_COLUMNS)
    .order("created_at", { ascending: false });
  throwIfError(error);
  return ((data ?? []) as CampaignRow[]).map(fromRow);
}

export async function queryCampaigns(
  supabase: unknown,
  params: MarketingCampaignListParams = {},
): Promise<MarketingCampaignListResult> {
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(params.pageSize ?? 20)));
  const from = (page - 1) * pageSize;
  let query = db(supabase)
    .from("marketing_campaigns")
    .select(CAMPAIGN_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (params.status) query = query.eq("status", params.status);
  const search = params.search?.trim().toLowerCase().replace(/[%_,()\"]/g, "");
  if (search) query = query.or(`name.ilike.%${search}%,subject.ilike.%${search}%`);
  const { data, error, count } = await query;
  throwIfError(error);
  const total = count ?? 0;
  return {
    items: ((data ?? []) as CampaignRow[]).map(fromRow),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getCampaign(
  supabase: unknown,
  id: string,
): Promise<MarketingCampaign | null> {
  const { data, error } = await db(supabase)
    .from("marketing_campaigns")
    .select(CAMPAIGN_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  throwIfError(error);
  return data ? fromRow(data as CampaignRow) : null;
}

export async function createCampaign(
  supabase: unknown,
  input: CreateCampaignInput,
): Promise<MarketingCampaign> {
  validateCampaignInput(input);
  if (!input.topicId) throw new Error("Campaign topic is required.");
  const { data, error } = await db(supabase)
    .from("marketing_campaigns")
    .insert(payloadFromInput(input))
    .select(CAMPAIGN_COLUMNS)
    .single();
  throwIfError(error);
  return fromRow(data as CampaignRow);
}

export async function updateCampaign(
  supabase: unknown,
  id: string,
  input: UpdateCampaignInput,
): Promise<MarketingCampaign> {
  validateCampaignInput(input);
  const current = await getCampaign(supabase, id);
  if (!current) throw new Error("Campaign not found.");
  if (current.status !== "draft" && current.status !== "scheduled") {
    throw new Error("Only draft or scheduled campaigns can be edited.");
  }
  const { data, error } = await db(supabase)
    .from("marketing_campaigns")
    .update(payloadFromInput(input))
    .eq("id", id)
    .select(CAMPAIGN_COLUMNS)
    .single();
  throwIfError(error);
  return fromRow(data as CampaignRow);
}

export async function deleteCampaign(supabase: unknown, id: string): Promise<void> {
  const { data, error } = await db(supabase).rpc("delete_marketing_campaign_safely", {
    p_campaign_id: id,
  });
  throwIfError(error);
  if (data === "not_found") throw new Error("Campaign not found.");
  if (data !== "deleted") throw new Error("Only draft or canceled campaigns can be deleted.");
}

export async function scheduleCampaign(
  supabase: unknown,
  id: string,
  when: string | Date,
): Promise<MarketingCampaign> {
  const scheduledAt = new Date(when);
  if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
    throw new Error("Campaign schedule must be a future date.");
  }
  const current = await getCampaign(supabase, id);
  if (!current) throw new Error("Campaign not found.");
  if (current.status !== "draft" && current.status !== "scheduled") {
    throw new Error("Only draft or scheduled campaigns can be scheduled.");
  }
  const { data, error } = await db(supabase)
    .from("marketing_campaigns")
    .update({ status: "scheduled", scheduled_at: scheduledAt.toISOString() })
    .eq("id", id)
    .select(CAMPAIGN_COLUMNS)
    .single();
  throwIfError(error);
  return fromRow(data as CampaignRow);
}

export async function cancelCampaign(
  supabase: unknown,
  id: string,
): Promise<MarketingCampaign> {
  const current = await getCampaign(supabase, id);
  if (!current) throw new Error("Campaign not found.");
  if (!["draft", "scheduled", "sending"].includes(current.status)) {
    throw new Error("This campaign cannot be canceled.");
  }
  const { data, error } = await db(supabase)
    .from("marketing_campaigns")
    .update({ status: "canceled", scheduled_at: null })
    .eq("id", id)
    .select(CAMPAIGN_COLUMNS)
    .single();
  throwIfError(error);
  return fromRow(data as CampaignRow);
}

export async function listCampaignRecipients(supabase: unknown, campaignId: string) {
  const { data, error } = await db(supabase)
    .from("marketing_campaign_recipients")
    .select("id,campaign_id,contact_id,email,status,attempt_count,next_attempt_at,provider_message_id,error,sent_at,created_at,updated_at")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });
  throwIfError(error);
  return data ?? [];
}

export async function deleteCampaignRecipient(
  supabase: unknown,
  campaignId: string,
  recipientId: string,
): Promise<void> {
  const { data, error } = await db(supabase).rpc("delete_marketing_campaign_recipient_safely", {
    p_campaign_id: campaignId,
    p_recipient_id: recipientId,
  });
  throwIfError(error);
  if (data === "campaign_not_found") throw new Error("Campaign not found.");
  if (data === "campaign_locked") throw new Error("Recipients cannot be removed after delivery has started.");
  if (data !== "deleted") throw new Error("Only queued, suppressed, or skipped recipients can be removed.");
}

export async function expandCampaignRecipients(
  supabase: unknown,
  campaignId: string,
): Promise<{ total: number; queued: number; suppressed: number }> {
  const campaign = await getCampaign(supabase, campaignId);
  if (!campaign) throw new Error("Campaign not found.");

  const subscriptionRows = await collectPages<{ contact_id: string }>(() => db(supabase)
    .from("marketing_subscriptions")
    .select("contact_id")
    .eq("topic_id", campaign.topicId)
    .eq("status", "subscribed")
    .order("contact_id", { ascending: true }));
  const contactIds = Array.from(new Set(
    subscriptionRows.map((row) => row.contact_id),
  ));

  if (contactIds.length === 0) {
    return { total: campaign.totalRecipients, queued: 0, suppressed: 0 };
  }

  let contactRows: Array<{ id: string; email: string }> = [];
  for (const contactIdChunk of chunks(contactIds)) {
    const contacts = await db(supabase)
      .from("crm_contacts")
      .select("id,email")
      .in("id", contactIdChunk)
      .not("email", "is", null);
    throwIfError(contacts.error);
    contactRows.push(...(contacts.data ?? []) as Array<{ id: string; email: string }>);
  }
  if (campaign.segmentId) {
    const segmentContacts = await resolveSegmentContacts(
      supabase,
      campaign.segmentId,
      { all: true },
    );
    const segmentContactIds = new Set(segmentContacts.map((contact) => contact.id));
    contactRows = contactRows.filter((contact) => segmentContactIds.has(contact.id));
  }
  const normalizedEmails = Array.from(new Set(
    contactRows.map((row) => row.email.trim().toLowerCase()).filter(Boolean),
  ));
  const suppressedEmails = new Set<string>();
  for (const emailChunk of chunks(normalizedEmails)) {
    const suppressionResult = await db(supabase)
      .from("marketing_suppressions")
      .select("email")
      .in("email", emailChunk);
    throwIfError(suppressionResult.error);
    for (const row of (suppressionResult.data ?? []) as Array<{ email: string }>) {
      suppressedEmails.add(row.email.trim().toLowerCase());
    }
  }
  const rows = contactRows
    .map((contact) => ({
      campaign_id: campaignId,
      contact_id: contact.id,
      email: contact.email.trim().toLowerCase(),
      status: suppressedEmails.has(contact.email.trim().toLowerCase())
        ? "suppressed"
        : "queued",
    }))
    .filter((row) => row.email);

  for (const rowChunk of chunks(rows)) {
    const inserted = await db(supabase)
      .from("marketing_campaign_recipients")
      .upsert(rowChunk, {
        onConflict: "campaign_id,contact_id",
        ignoreDuplicates: true,
      });
    throwIfError(inserted.error);
  }
  const { count, error: countError } = await db(supabase)
    .from("marketing_campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId);
  throwIfError(countError);
  const total = count ?? rows.length;
  return {
    total,
    queued: rows.filter((row) => row.status === "queued").length,
    suppressed: rows.filter((row) => row.status === "suppressed").length,
  };
}

export async function sendCampaignNow(
  supabase: unknown,
  id: string,
): Promise<MarketingCampaign> {
  const current = await getCampaign(supabase, id);
  if (!current) throw new Error("Campaign not found.");
  if (current.status !== "draft" && current.status !== "scheduled") {
    throw new Error("Only draft or scheduled campaigns can be sent.");
  }
  await expandCampaignRecipients(supabase, id);
  const { data, error } = await db(supabase)
    .from("marketing_campaigns")
    .update({ status: "sending", scheduled_at: null })
    .eq("id", id)
    .in("status", ["draft", "scheduled"])
    .select(CAMPAIGN_COLUMNS)
    .single();
  throwIfError(error);
  return fromRow(data as CampaignRow);
}

export async function retryCampaignFailures(
  supabase: unknown,
  id: string,
): Promise<MarketingCampaign> {
  const campaign = await getCampaign(supabase, id);
  if (!campaign) throw new Error("Campaign not found.");
  const reset = await db(supabase)
    .from("marketing_campaign_recipients")
    .update({ status: "queued", error: null, next_attempt_at: null })
    .eq("campaign_id", id)
    .eq("status", "failed");
  throwIfError(reset.error);
  const updated = await db(supabase)
    .from("marketing_campaigns")
    .update({ status: "sending", failed_count: 0, sent_at: null })
    .eq("id", id)
    .select(CAMPAIGN_COLUMNS)
    .single();
  throwIfError(updated.error);
  return fromRow(updated.data as CampaignRow);
}

export async function sendTestEmail(
  supabase: unknown,
  id: string,
  toEmail: string,
  sender: MarketingEmailSender,
) {
  const campaign = await getCampaign(supabase, id);
  if (!campaign) throw new Error("Campaign not found.");
  if (!toEmail.trim() || !toEmail.includes("@")) throw new Error("A valid email is required.");
  const normalizedEmail = toEmail.trim().toLowerCase();
  if (await isSuppressed(supabase, normalizedEmail)) {
    throw new Error("Test email recipient is suppressed.");
  }
  return sender.sendOne({
    to: normalizedEmail,
    subject: `[Test] ${campaign.subject}`,
    html: campaign.bodyHtml,
    text: campaign.bodyText,
    fromName: campaign.fromName,
    fromEmail: campaign.fromEmail,
  });
}
