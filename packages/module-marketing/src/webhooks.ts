import { Webhook } from "svix";

type WebhookClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{
    data: unknown;
    error: { message?: string; code?: string } | null;
  }>;
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

  const result = await db(supabase).rpc("process_marketing_resend_webhook", {
    p_provider_event_id: providerEventId || null,
    p_event_type: eventType,
    p_provider_message_id: providerMessageId,
    p_payload: verified,
    p_occurred_at: verified.created_at ?? new Date().toISOString(),
  });
  throwIfError(result.error);
  const row = (Array.isArray(result.data) ? result.data[0] : result.data) as {
    duplicate?: boolean;
    event_type?: string;
    recipient_id?: string | null;
  } | null;
  if (!row || typeof row.duplicate !== "boolean") {
    throw new Error("Marketing webhook transaction returned an invalid result.");
  }
  return {
    duplicate: row.duplicate,
    eventType: row.event_type ?? eventType,
    recipientId: row.recipient_id ?? null,
  };
}
