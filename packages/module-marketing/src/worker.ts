import { expandCampaignRecipients, getCampaign } from "./campaigns";
import type {
  MarketingEmailMessage,
  MarketingEmailResult,
  MarketingEmailSender,
} from "./email/types";

type WorkerClient = {
  from: (table: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{
    data: unknown;
    error: { message?: string } | null;
  }>;
};

type RecipientRow = {
  id: string;
  campaign_id: string;
  contact_id: string | null;
  email: string;
  attempt_count: number;
};

export type MarketingWorkerDependencies = {
  supabase: unknown;
  sender: MarketingEmailSender;
  now?: () => Date;
  publicAppUrl?: string | null;
  maxCampaigns?: number;
};

export type MarketingWorkerResult = {
  promotedCampaigns: number;
  processedCampaigns: number;
  claimed: number;
  sent: number;
  failed: number;
};

function db(supabase: unknown) {
  return supabase as WorkerClient;
}

function throwIfError(error: { message?: string } | null | undefined) {
  if (error) throw new Error(error.message || "Marketing worker database request failed.");
}

function retryAt(now: Date, attemptCount: number) {
  const delayMinutes = Math.min(24 * 60, 2 ** Math.max(0, attemptCount - 1));
  return new Date(now.getTime() + delayMinutes * 60_000).toISOString();
}

async function promoteScheduledCampaigns(
  dependencies: MarketingWorkerDependencies,
  now: Date,
) {
  const result = await db(dependencies.supabase)
    .from("marketing_campaigns")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_at", now.toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(Math.max(1, dependencies.maxCampaigns ?? 25));
  throwIfError(result.error);

  let promoted = 0;
  for (const row of (result.data ?? []) as Array<{ id: string }>) {
    await expandCampaignRecipients(dependencies.supabase, row.id);
    const update = await db(dependencies.supabase)
      .from("marketing_campaigns")
      .update({ status: "sending", scheduled_at: null })
      .eq("id", row.id)
      .eq("status", "scheduled")
      .select("id");
    throwIfError(update.error);
    if ((update.data ?? []).length) promoted += 1;
  }
  return promoted;
}

async function unsubscribeTokens(
  supabase: unknown,
  rows: RecipientRow[],
): Promise<Map<string, string>> {
  const contactIds = Array.from(new Set(
    rows.map((row) => row.contact_id).filter((id): id is string => Boolean(id)),
  ));
  if (!contactIds.length) return new Map();
  const result = await db(supabase)
    .from("marketing_contact_settings")
    .select("contact_id,unsubscribe_token")
    .in("contact_id", contactIds);
  throwIfError(result.error);
  return new Map(
    ((result.data ?? []) as Array<{ contact_id: string; unsubscribe_token: string }>)
      .map((row) => [row.contact_id, row.unsubscribe_token]),
  );
}

function messageForRecipient(
  campaign: NonNullable<Awaited<ReturnType<typeof getCampaign>>>,
  recipient: RecipientRow,
  token: string | undefined,
  publicAppUrl: string | null | undefined,
): MarketingEmailMessage {
  const unsubscribeUrl = token && publicAppUrl
    ? `${publicAppUrl.replace(/\/+$/, "")}/api/marketing/unsubscribe/${token}`
    : null;
  return {
    to: recipient.email,
    subject: campaign.subject,
    html: campaign.bodyHtml,
    text: campaign.bodyText,
    fromName: campaign.fromName,
    fromEmail: campaign.fromEmail,
    headers: unsubscribeUrl
      ? {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      }
      : undefined,
    tags: [
      { name: "campaign_id", value: campaign.id },
      { name: "recipient_id", value: recipient.id },
    ],
  };
}

async function applyDeliveryResult(
  supabase: unknown,
  recipient: RecipientRow,
  result: MarketingEmailResult,
  now: Date,
) {
  const payload = result.ok
    ? {
      status: "sent",
      provider_message_id: result.providerMessageId,
      error: null,
      next_attempt_at: null,
      sent_at: now.toISOString(),
    }
    : {
      status: "failed",
      error: result.error.slice(0, 2000),
      next_attempt_at: retryAt(now, recipient.attempt_count),
    };
  const update = await db(supabase)
    .from("marketing_campaign_recipients")
    .update(payload)
    .eq("id", recipient.id)
    .eq("status", "sending");
  throwIfError(update.error);
}

async function refreshCampaignState(supabase: unknown, campaignId: string, now: Date) {
  const rowsResult = await db(supabase)
    .from("marketing_campaign_recipients")
    .select("status")
    .eq("campaign_id", campaignId);
  throwIfError(rowsResult.error);
  const statuses = ((rowsResult.data ?? []) as Array<{ status: string }>)
    .map((row) => row.status);
  const sentCount = statuses.filter((status) => status === "sent").length;
  const failedCount = statuses.filter((status) => status === "failed").length;
  const queueDrained = !statuses.some(
    (status) => status === "queued" || status === "sending",
  );
  const update = await db(supabase)
    .from("marketing_campaigns")
    .update({
      sent_count: sentCount,
      failed_count: failedCount,
      ...(queueDrained ? { status: "sent", sent_at: now.toISOString() } : {}),
    })
    .eq("id", campaignId)
    .eq("status", "sending");
  throwIfError(update.error);
}

export async function runMarketingWorker(
  dependencies: MarketingWorkerDependencies,
): Promise<MarketingWorkerResult> {
  const now = (dependencies.now ?? (() => new Date()))();
  const promotedCampaigns = await promoteScheduledCampaigns(dependencies, now);
  const campaignResult = await db(dependencies.supabase)
    .from("marketing_campaigns")
    .select("id,batch_size,rate_per_minute")
    .eq("status", "sending")
    .order("updated_at", { ascending: true })
    .limit(Math.max(1, dependencies.maxCampaigns ?? 25));
  throwIfError(campaignResult.error);

  const totals: MarketingWorkerResult = {
    promotedCampaigns,
    processedCampaigns: 0,
    claimed: 0,
    sent: 0,
    failed: 0,
  };

  for (const row of (campaignResult.data ?? []) as Array<{
    id: string;
    batch_size: number;
    rate_per_minute: number | null;
  }>) {
    const campaign = await getCampaign(dependencies.supabase, row.id);
    if (!campaign || campaign.status !== "sending") continue;
    const batchSize = Math.max(
      1,
      Math.min(1000, row.batch_size, row.rate_per_minute ?? row.batch_size),
    );
    const claim = await db(dependencies.supabase).rpc(
      "claim_marketing_campaign_recipients",
      {
        target_campaign_id: row.id,
        claim_limit: batchSize,
        claim_time: now.toISOString(),
      },
    );
    throwIfError(claim.error);
    const recipients = (claim.data ?? []) as RecipientRow[];
    totals.processedCampaigns += 1;
    totals.claimed += recipients.length;
    if (!recipients.length) {
      await refreshCampaignState(dependencies.supabase, row.id, now);
      continue;
    }

    const tokens = await unsubscribeTokens(dependencies.supabase, recipients);
    let results: MarketingEmailResult[];
    try {
      results = await dependencies.sender.sendBatch(
        recipients.map((recipient) => messageForRecipient(
          campaign,
          recipient,
          recipient.contact_id ? tokens.get(recipient.contact_id) : undefined,
          dependencies.publicAppUrl,
        )),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Email sender failed.";
      results = recipients.map(() => ({ ok: false, error: message }));
    }

    for (let index = 0; index < recipients.length; index += 1) {
      const result = results[index] ?? {
        ok: false as const,
        error: "Email sender returned no result.",
      };
      await applyDeliveryResult(
        dependencies.supabase,
        recipients[index]!,
        result,
        now,
      );
      if (result.ok) totals.sent += 1;
      else totals.failed += 1;
    }
    await refreshCampaignState(dependencies.supabase, row.id, now);
  }

  return totals;
}
