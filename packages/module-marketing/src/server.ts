import "server-only";

import { createServiceRoleClient } from "@brightweblabs/infra/server";
import type {
  ConsentSource,
  ContactSubscriptionState,
  MarketingContactSettings,
  MarketingSubscription,
  MarketingTopic,
  ResolvedUnsubscribeContact,
  SubscriptionStatus,
  SuppressionReason,
} from "./types";
import { enqueueWorkflowRunsForTrigger } from "./workflows";

type QueryClient = {
  from: (table: string) => any;
  rpc: (name: string, parameters: Record<string, unknown>) => Promise<{
    error: { message?: string } | null;
  }>;
};

type TopicRow = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  is_active: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};

type SubscriptionRow = {
  id: string;
  contact_id: string;
  topic_id: string;
  status: SubscriptionStatus;
  consent_source: string | null;
  consent_at: string | null;
  unsubscribed_at: string | null;
  created_at: string;
  updated_at: string;
};

type SettingsRow = {
  contact_id: string;
  unsubscribe_token: string;
  preferred_language: string | null;
  created_at: string;
  updated_at: string;
};

function client(supabase: unknown) {
  return supabase as QueryClient;
}

function throwIfError(error: { message?: string } | null | undefined) {
  if (error) throw new Error(error.message || "Marketing database request failed.");
}

function topicFromRow(row: TopicRow): MarketingTopic {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    description: row.description,
    isActive: row.is_active,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function subscriptionFromRow(row: SubscriptionRow): MarketingSubscription {
  return {
    id: row.id,
    contactId: row.contact_id,
    topicId: row.topic_id,
    status: row.status,
    consentSource: row.consent_source,
    consentAt: row.consent_at,
    unsubscribedAt: row.unsubscribed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function settingsFromRow(row: SettingsRow): MarketingContactSettings {
  return {
    contactId: row.contact_id,
    unsubscribeToken: row.unsubscribe_token,
    preferredLanguage: row.preferred_language,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listTopics(
  supabase: unknown,
  options: { activeOnly?: boolean } = {},
): Promise<MarketingTopic[]> {
  let query = client(supabase)
    .from("marketing_topics")
    .select("id,slug,label,description,is_active,position,created_at,updated_at")
    .order("position", { ascending: true })
    .order("label", { ascending: true });

  if (options.activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query;
  throwIfError(error);
  return ((data ?? []) as TopicRow[]).map(topicFromRow);
}

export type CreateMarketingTopicInput = {
  slug: string;
  label: string;
  description?: string | null;
  position?: number;
};

export type UpdateMarketingTopicInput = Partial<
  Pick<CreateMarketingTopicInput, "label" | "description" | "position">
> & {
  isActive?: boolean;
};

const TOPIC_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TOPIC_COLUMNS = "id,slug,label,description,is_active,position,created_at,updated_at";

function topicPayload(input: CreateMarketingTopicInput | UpdateMarketingTopicInput) {
  const payload: Record<string, unknown> = {};
  if ("slug" in input && input.slug !== undefined) payload.slug = input.slug.trim();
  if (input.label !== undefined) payload.label = input.label.trim();
  if (input.description !== undefined) payload.description = input.description?.trim() || null;
  if (input.position !== undefined) payload.position = input.position;
  if ("isActive" in input && input.isActive !== undefined) payload.is_active = input.isActive;
  return payload;
}

function validateTopicInput(input: CreateMarketingTopicInput | UpdateMarketingTopicInput) {
  if (input.label !== undefined && !input.label.trim()) {
    throw new Error("Topic label is required.");
  }
  if ("slug" in input && input.slug !== undefined && !TOPIC_SLUG_PATTERN.test(input.slug.trim())) {
    throw new Error("Topic slug must use lowercase letters, numbers, and hyphens only.");
  }
  if (input.position !== undefined && (!Number.isInteger(input.position) || input.position < 0)) {
    throw new Error("Topic position must be a non-negative integer.");
  }
}

export async function createTopic(
  supabase: unknown,
  input: CreateMarketingTopicInput,
): Promise<MarketingTopic> {
  validateTopicInput(input);
  if (!input.slug?.trim()) throw new Error("Topic slug is required.");
  if (!input.label?.trim()) throw new Error("Topic label is required.");
  const { data, error } = await client(supabase)
    .from("marketing_topics")
    .insert(topicPayload(input))
    .select(TOPIC_COLUMNS)
    .single();
  if (error?.code === "23505") throw new Error("Topic slug already exists.");
  throwIfError(error);
  return topicFromRow(data as TopicRow);
}

export async function updateTopic(
  supabase: unknown,
  id: string,
  input: UpdateMarketingTopicInput,
): Promise<MarketingTopic> {
  validateTopicInput(input);
  const { data, error } = await client(supabase)
    .from("marketing_topics")
    .update(topicPayload(input))
    .eq("id", id)
    .select(TOPIC_COLUMNS)
    .maybeSingle();
  throwIfError(error);
  if (!data) throw new Error("Topic not found.");
  return topicFromRow(data as TopicRow);
}

export async function deleteTopic(supabase: unknown, id: string): Promise<void> {
  const { count, error: campaignError } = await client(supabase)
    .from("marketing_campaigns")
    .select("id", { count: "exact", head: true })
    .eq("topic_id", id);
  throwIfError(campaignError);
  if ((count ?? 0) > 0) {
    throw new Error("Topic is used by campaigns and must be deactivated instead.");
  }
  const { data, error } = await client(supabase)
    .from("marketing_topics")
    .delete()
    .eq("id", id)
    .select("id");
  if (error?.code === "23503") {
    throw new Error("Topic is used by campaigns and must be deactivated instead.");
  }
  throwIfError(error);
  if (!(data ?? []).some((row: { id?: string }) => row.id === id)) throw new Error("Topic not found.");
}

export async function reorderTopics(
  supabase: unknown,
  topicIds: string[],
): Promise<MarketingTopic[]> {
  if (topicIds.length === 0 || new Set(topicIds).size !== topicIds.length) {
    throw new Error("Topic order must contain unique topic IDs.");
  }
  const { error } = await client(supabase).rpc("reorder_marketing_topics", {
    p_topic_ids: topicIds,
  });
  throwIfError(error);
  return listTopics(supabase);
}

export async function getContactSubscriptions(
  supabase: unknown,
  contactId: string,
): Promise<ContactSubscriptionState[]> {
  const topics = await listTopics(supabase);
  const { data, error } = await client(supabase)
    .from("marketing_subscriptions")
    .select("id,contact_id,topic_id,status,consent_source,consent_at,unsubscribed_at,created_at,updated_at")
    .eq("contact_id", contactId);
  throwIfError(error);
  const subscriptions = new Map(
    ((data ?? []) as SubscriptionRow[]).map((row) => [row.topic_id, row]),
  );

  return topics.map((topic) => {
    const subscription = subscriptions.get(topic.id);
    return {
      topic,
      status: subscription?.status ?? null,
      consentAt: subscription?.consent_at ?? null,
      unsubscribedAt: subscription?.unsubscribed_at ?? null,
    };
  });
}

export async function setSubscription(
  supabase: unknown,
  input: {
    contactId: string;
    topicId: string;
    status: SubscriptionStatus;
    consentSource: ConsentSource;
  },
): Promise<MarketingSubscription> {
  const previousResult = await client(supabase)
    .from("marketing_subscriptions")
    .select("status")
    .eq("contact_id", input.contactId)
    .eq("topic_id", input.topicId)
    .maybeSingle();
  throwIfError(previousResult.error);
  const timestamp = new Date().toISOString();
  const payload: Record<string, string | null> = {
    contact_id: input.contactId,
    topic_id: input.topicId,
    status: input.status,
    consent_source: input.consentSource,
    unsubscribed_at: input.status === "unsubscribed" ? timestamp : null,
  };
  if (input.status === "subscribed") {
    payload.consent_at = timestamp;
  }
  const { data, error } = await client(supabase)
    .from("marketing_subscriptions")
    .upsert(payload, { onConflict: "contact_id,topic_id" })
    .select("id,contact_id,topic_id,status,consent_source,consent_at,unsubscribed_at,created_at,updated_at")
    .single();
  throwIfError(error);
  const subscription = subscriptionFromRow(data as SubscriptionRow);
  if (
    input.status === "subscribed"
    && previousResult.data?.status !== "subscribed"
  ) {
    await enqueueWorkflowRunsForTrigger(supabase, {
      triggerType: "contact_subscribed",
      contactId: input.contactId,
      matchData: { topicId: input.topicId },
    });
  }
  return subscription;
}

export async function ensureContactSettings(
  supabase: unknown,
  contactId: string,
): Promise<MarketingContactSettings> {
  const table = client(supabase).from("marketing_contact_settings");
  const existing = await table
    .select("contact_id,unsubscribe_token,preferred_language,created_at,updated_at")
    .eq("contact_id", contactId)
    .maybeSingle();
  throwIfError(existing.error);
  if (existing.data) return settingsFromRow(existing.data as SettingsRow);

  const inserted = await client(supabase)
    .from("marketing_contact_settings")
    .insert({ contact_id: contactId })
    .select("contact_id,unsubscribe_token,preferred_language,created_at,updated_at")
    .single();
  if (inserted.error?.code === "23505") {
    return ensureContactSettings(supabase, contactId);
  }
  throwIfError(inserted.error);
  return settingsFromRow(inserted.data as SettingsRow);
}

export async function resolveByUnsubscribeToken(
  supabase: unknown,
  token: string,
): Promise<ResolvedUnsubscribeContact | null> {
  const settingsResult = await client(supabase)
    .from("marketing_contact_settings")
    .select("contact_id")
    .eq("unsubscribe_token", token)
    .maybeSingle();
  throwIfError(settingsResult.error);
  if (!settingsResult.data) return null;

  const contactId = (settingsResult.data as { contact_id: string }).contact_id;
  const contactResult = await client(supabase)
    .from("crm_contacts")
    .select("id,first_name,last_name,email")
    .eq("id", contactId)
    .maybeSingle();
  throwIfError(contactResult.error);
  if (!contactResult.data) return null;
  const contact = contactResult.data as {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  };

  return {
    contact: {
      id: contact.id,
      firstName: contact.first_name,
      lastName: contact.last_name,
    },
    email: contact.email,
    subscriptions: await getContactSubscriptions(supabase, contactId),
  };
}

export async function suppress(
  supabase: unknown,
  input: { email: string; reason: SuppressionReason; source?: string | null },
) {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("A valid email is required.");
  const { data, error } = await client(supabase)
    .from("marketing_suppressions")
    .upsert(
      { email, reason: input.reason, source: input.source ?? null },
      { onConflict: "email" },
    )
    .select("id,email,reason,source,created_at")
    .single();
  throwIfError(error);
  const recipients = await client(supabase)
    .from("marketing_campaign_recipients")
    .update({
      status: "suppressed",
      error: `Email suppressed: ${input.reason}.`,
      next_attempt_at: null,
    })
    .eq("email", email)
    .in("status", ["queued", "sending"]);
  throwIfError(recipients.error);
  return data;
}

export async function isSuppressed(supabase: unknown, email: string): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return true;
  const { data, error } = await client(supabase)
    .from("marketing_suppressions")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();
  throwIfError(error);
  return Boolean(data);
}

export async function isEmailable(
  supabase: unknown,
  contactId: string,
  topicId: string,
): Promise<boolean> {
  const subscriptionResult = await client(supabase)
    .from("marketing_subscriptions")
    .select("status")
    .eq("contact_id", contactId)
    .eq("topic_id", topicId)
    .maybeSingle();
  throwIfError(subscriptionResult.error);
  if (subscriptionResult.data?.status !== "subscribed") return false;

  const contactResult = await client(supabase)
    .from("crm_contacts")
    .select("email")
    .eq("id", contactId)
    .maybeSingle();
  throwIfError(contactResult.error);
  const email = contactResult.data?.email;
  return typeof email === "string" && email.trim() !== ""
    ? !(await isSuppressed(supabase, email))
    : false;
}

async function suppressPendingRecipientsForContact(
  supabase: unknown,
  contactId: string,
  topicId?: string,
) {
  let campaignIds: string[] | null = null;
  if (topicId) {
    const campaigns = await client(supabase)
      .from("marketing_campaigns")
      .select("id")
      .eq("topic_id", topicId)
      .in("status", ["scheduled", "sending"]);
    throwIfError(campaigns.error);
    campaignIds = ((campaigns.data ?? []) as Array<{ id: string }>)
      .map((campaign) => campaign.id);
    if (!campaignIds.length) return;
  }

  let recipients = client(supabase)
    .from("marketing_campaign_recipients")
    .update({
      status: "suppressed",
      error: "Contact unsubscribed before delivery.",
      next_attempt_at: null,
    })
    .eq("contact_id", contactId)
    .in("status", ["queued", "sending"]);
  if (campaignIds) recipients = recipients.in("campaign_id", campaignIds);
  const result = await recipients;
  throwIfError(result.error);
}

export async function unsubscribeTopic(
  supabase: unknown,
  token: string,
  topicId: string,
): Promise<ResolvedUnsubscribeContact | null> {
  const resolved = await resolveByUnsubscribeToken(supabase, token);
  if (!resolved) return null;
  await setSubscription(supabase, {
    contactId: resolved.contact.id,
    topicId,
    status: "unsubscribed",
    consentSource: "unsubscribe",
  });
  await suppressPendingRecipientsForContact(supabase, resolved.contact.id, topicId);
  return resolveByUnsubscribeToken(supabase, token);
}

export async function unsubscribeAll(
  supabase: unknown,
  token: string,
): Promise<ResolvedUnsubscribeContact | null> {
  const resolved = await resolveByUnsubscribeToken(supabase, token);
  if (!resolved) return null;
  const timestamp = new Date().toISOString();
  const updateResult = await client(supabase)
    .from("marketing_subscriptions")
    .update({
      status: "unsubscribed",
      consent_source: "unsubscribe",
      unsubscribed_at: timestamp,
    })
    .eq("contact_id", resolved.contact.id);
  throwIfError(updateResult.error);
  await suppressPendingRecipientsForContact(supabase, resolved.contact.id);

  if (resolved.email) {
    await suppress(supabase, {
      email: resolved.email,
      reason: "unsubscribed_all",
      source: "unsubscribe-token",
    });
  }
  return resolveByUnsubscribeToken(supabase, token);
}

export function createMarketingServiceClient() {
  return createServiceRoleClient();
}
