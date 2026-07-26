import { Webhook } from "svix";
import { suppress } from "./server";

type WebhookClient = {
  from: (table: string) => any;
};

type ResendWebhookPayload = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[] | string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type ResendWebhookResult = {
  duplicate: boolean;
  eventType: string;
  recipientId: string | null;
};

function db(supabase: unknown) {
  return supabase as WebhookClient;
}

function throwIfError(error: { message?: string; code?: string } | null | undefined) {
  if (error) throw new Error(error.message || "Marketing webhook database request failed.");
}

function headerValue(headers: Headers | Record<string, string>, name: string) {
  if (headers instanceof Headers) return headers.get(name) ?? "";
  const entry = Object.entries(headers)
    .find(([key]) => key.toLowerCase() === name.toLowerCase());
  return entry?.[1] ?? "";
}

function normalizeEventType(type: string) {
  return type.startsWith("email.") ? type.slice("email.".length) : type;
}

function isSuppressionEvent(type: string) {
  return type === "bounced" || type === "complained" || type === "unsubscribed";
}

export async function processResendWebhook(
  supabase: unknown,
  rawBody: string,
  headers: Headers | Record<string, string>,
  webhookSecret: string,
): Promise<ResendWebhookResult> {
  if (!webhookSecret.trim()) throw new Error("Resend webhook secret is not configured.");
  const verified = new Webhook(webhookSecret).verify(rawBody, {
    "svix-id": headerValue(headers, "svix-id"),
    "svix-timestamp": headerValue(headers, "svix-timestamp"),
    "svix-signature": headerValue(headers, "svix-signature"),
  }) as ResendWebhookPayload;
  const eventType = normalizeEventType(verified.type ?? "unknown");
  const providerEventId = headerValue(headers, "svix-id");
  const providerMessageId = verified.data?.email_id ?? null;

  let recipient: {
    id: string;
    campaign_id: string;
    contact_id: string | null;
    email: string;
  } | null = null;
  if (providerMessageId) {
    const recipientResult = await db(supabase)
      .from("marketing_campaign_recipients")
      .select("id,campaign_id,contact_id,email")
      .eq("provider_message_id", providerMessageId)
      .maybeSingle();
    throwIfError(recipientResult.error);
    recipient = recipientResult.data;
  }

  const inserted = await db(supabase)
    .from("marketing_message_events")
    .insert({
      campaign_id: recipient?.campaign_id ?? null,
      recipient_id: recipient?.id ?? null,
      contact_id: recipient?.contact_id ?? null,
      provider: "resend",
      event_type: eventType,
      provider_event_id: providerEventId || null,
      payload: verified,
      occurred_at: verified.created_at ?? new Date().toISOString(),
    });
  if (inserted.error?.code === "23505") {
    return { duplicate: true, eventType, recipientId: recipient?.id ?? null };
  }
  throwIfError(inserted.error);

  if (recipient && (eventType === "delivered" || eventType === "sent")) {
    const recipientUpdate = await db(supabase)
      .from("marketing_campaign_recipients")
      .update({
        status: "sent",
        sent_at: verified.created_at ?? new Date().toISOString(),
        error: null,
      })
      .eq("id", recipient.id);
    throwIfError(recipientUpdate.error);
  } else if (recipient && eventType === "failed") {
    const recipientUpdate = await db(supabase)
      .from("marketing_campaign_recipients")
      .update({ status: "failed", error: "Resend reported delivery failure." })
      .eq("id", recipient.id);
    throwIfError(recipientUpdate.error);
  } else if (recipient && isSuppressionEvent(eventType)) {
    const recipientUpdate = await db(supabase)
      .from("marketing_campaign_recipients")
      .update({
        status: "suppressed",
        error: `Resend reported ${eventType}.`,
      })
      .eq("id", recipient.id);
    throwIfError(recipientUpdate.error);
    await suppress(supabase, {
      email: recipient.email,
      reason: (
        eventType === "bounced"
          ? "bounced"
          : eventType === "complained"
            ? "complained"
            : "unsubscribed_all"
      ),
      source: "resend_webhook",
    });
    if (recipient.contact_id) {
      const subscriptions = await db(supabase)
        .from("marketing_subscriptions")
        .update({
          status: "unsubscribed",
          unsubscribed_at: new Date().toISOString(),
        })
        .eq("contact_id", recipient.contact_id);
      throwIfError(subscriptions.error);
    }
  }

  return { duplicate: false, eventType, recipientId: recipient?.id ?? null };
}
