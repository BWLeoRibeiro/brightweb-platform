import { expandCampaignRecipients, getCampaign } from "./campaigns";
import type {
  MarketingEmailMessage,
  MarketingEmailResult,
  MarketingEmailSender,
} from "./email/types";
import {
  processDueWorkflowRuns,
  scanActivityTriggers,
} from "./workflows";
import { isEmailable, isSuppressed } from "./server";

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
  next_attempt_at?: string | null;
  updated_at?: string;
};

const MAX_DELIVERY_ATTEMPTS = 3;

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
  activityEventsScanned: number;
  workflowRunsEnqueued: number;
  workflowRunsClaimed: number;
  workflowRunsCompleted: number;
  workflowRunsFailed: number;
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

async function suppressRecipient(supabase: unknown, recipientId: string) {
  const update = await db(supabase)
    .from("marketing_campaign_recipients")
    .update({
      status: "suppressed",
      error: "Consent or suppression changed before delivery.",
      next_attempt_at: null,
    })
    .eq("id", recipientId)
    .eq("status", "sending");
  throwIfError(update.error);
}

async function emailableRecipients(
  supabase: unknown,
  topicId: string,
  recipients: RecipientRow[],
) {
  const checks = await Promise.all(recipients.map(async (recipient) => {
    const emailable = recipient.contact_id
      ? await isEmailable(supabase, recipient.contact_id, topicId)
      : !(await isSuppressed(supabase, recipient.email));
    return { recipient, emailable };
  }));
  const allowed: RecipientRow[] = [];
  for (const check of checks) {
    if (check.emailable) {
      allowed.push(check.recipient);
    } else {
      await suppressRecipient(supabase, check.recipient.id);
    }
  }
  return allowed;
}

async function refreshCampaignState(supabase: unknown, campaignId: string, now: Date) {
  const rowsResult = await db(supabase)
    .from("marketing_campaign_recipients")
    .select("status,attempt_count")
    .eq("campaign_id", campaignId);
  throwIfError(rowsResult.error);
  const rows = (rowsResult.data ?? []) as Array<{
    status: string;
    attempt_count: number;
  }>;
  const statuses = rows.map((row) => row.status);
  const sentCount = statuses.filter((status) => status === "sent").length;
  const failedCount = statuses.filter((status) => status === "failed").length;
  const queueDrained = !rows.some(
    (row) =>
      row.status === "queued"
      || row.status === "sending"
      || (row.status === "failed" && row.attempt_count < MAX_DELIVERY_ATTEMPTS),
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
    activityEventsScanned: 0,
    workflowRunsEnqueued: 0,
    workflowRunsClaimed: 0,
    workflowRunsCompleted: 0,
    workflowRunsFailed: 0,
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
    const claimedRecipients = (claim.data ?? []) as RecipientRow[];
    totals.processedCampaigns += 1;
    totals.claimed += claimedRecipients.length;
    if (!claimedRecipients.length) {
      await refreshCampaignState(dependencies.supabase, row.id, now);
      continue;
    }

    const recipients = await emailableRecipients(
      dependencies.supabase,
      campaign.topicId,
      claimedRecipients,
    );
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

  const activity = await scanActivityTriggers(dependencies.supabase, { limit: 100 });
  const workflows = await processDueWorkflowRuns(
    dependencies.supabase,
    {
      sender: dependencies.sender,
      now: dependencies.now,
    },
    { limit: 25 },
  );
  totals.activityEventsScanned = activity.scanned;
  totals.workflowRunsEnqueued = activity.enqueued;
  totals.workflowRunsClaimed = workflows.claimed;
  totals.workflowRunsCompleted = workflows.completed;
  totals.workflowRunsFailed = workflows.failed;
  return totals;
}
