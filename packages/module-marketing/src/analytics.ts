export const MARKETING_ANALYTICS_EVENT_TYPES = [
  "sent",
  "delivered",
  "opened",
  "clicked",
  "unsubscribed",
  "bounced",
  "complained",
] as const;

export type MarketingAnalyticsEventType =
  (typeof MARKETING_ANALYTICS_EVENT_TYPES)[number];

export const MARKETING_RECIPIENT_STATUSES = [
  "queued",
  "sending",
  "sent",
  "failed",
  "suppressed",
  "skipped",
] as const;

export type MarketingRecipientStatus =
  (typeof MARKETING_RECIPIENT_STATUSES)[number];

export type MarketingQueueBreakdown = Record<MarketingRecipientStatus, number>;

export type MarketingOverviewMetrics = {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  bounced: number;
  complained: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  unsubRate: number;
  complaintRate: number;
  rawEventTotals: Record<MarketingAnalyticsEventType, number>;
};

export type MarketingCampaignAnalytics = MarketingOverviewMetrics & {
  campaignId: string;
  queue: MarketingQueueBreakdown;
};

export type MarketingSegmentAnalytics = MarketingOverviewMetrics & {
  segmentId: string;
  campaignCount: number;
  queue: MarketingQueueBreakdown;
};

export type MarketingAnalyticsEvent = {
  id?: string;
  recipient_id: string | null;
  event_type: string;
};

type AnalyticsClient = {
  from: (table: string) => any;
  rpc?: (name: string, params?: Record<string, unknown>) => Promise<{ data: unknown; error?: { code?: string; message?: string } | null }>;
};

type AnalyticsScope = {
  campaignId?: string;
  campaignIds?: string[];
  since?: string;
};

const EVENT_PAGE_SIZE = 1_000;

function db(supabase: unknown) {
  return supabase as AnalyticsClient;
}

function throwIfError(error: { message?: string } | null | undefined) {
  if (error) {
    throw new Error(error.message || "Marketing analytics database request failed.");
  }
}

function emptyRawEventTotals(): Record<MarketingAnalyticsEventType, number> {
  return {
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    unsubscribed: 0,
    bounced: 0,
    complained: 0,
  };
}

export function emptyMarketingMetrics(): MarketingOverviewMetrics {
  return {
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    unsubscribed: 0,
    bounced: 0,
    complained: 0,
    openRate: 0,
    clickRate: 0,
    bounceRate: 0,
    unsubRate: 0,
    complaintRate: 0,
    rawEventTotals: emptyRawEventTotals(),
  };
}

function emptyQueueBreakdown(): MarketingQueueBreakdown {
  return {
    queued: 0,
    sending: 0,
    sent: 0,
    failed: 0,
    suppressed: 0,
    skipped: 0,
  };
}

function percentage(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function aggregateRow(value: unknown): MarketingOverviewMetrics | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return null;
  const item = row as Record<string, unknown>;
  const number = (key: string) => Number(item[key] ?? 0);
  const sent = number("sent_count");
  const delivered = number("delivered_count");
  const opened = number("opened_count");
  const clicked = number("clicked_count");
  const unsubscribed = number("unsubscribed_count");
  const bounced = number("bounced_count");
  const complained = number("complained_count");
  const engagementBase = delivered || sent;
  return {
    sent,
    delivered,
    opened,
    clicked,
    unsubscribed,
    bounced,
    complained,
    openRate: percentage(opened, engagementBase),
    clickRate: percentage(clicked, engagementBase),
    bounceRate: percentage(bounced, sent),
    unsubRate: percentage(unsubscribed, sent),
    complaintRate: percentage(complained, sent),
    rawEventTotals: {
      sent: number("raw_sent_count"),
      delivered: number("raw_delivered_count"),
      opened: number("raw_opened_count"),
      clicked: number("raw_clicked_count"),
      unsubscribed: number("raw_unsubscribed_count"),
      bounced: number("raw_bounced_count"),
      complained: number("raw_complained_count"),
    },
  };
}

async function readAggregateRpc(supabase: unknown, name: string, params: Record<string, unknown>) {
  const client = db(supabase);
  if (typeof client.rpc !== "function") return null;
  const result = await client.rpc(name, params);
  if (!result.error) return result.data;
  if (result.error.code === "42883" || result.error.code === "PGRST202") return null;
  throw new Error(result.error.message || "Marketing analytics database request failed.");
}

export function aggregateMarketingMetrics(
  sent: number,
  events: MarketingAnalyticsEvent[],
): MarketingOverviewMetrics {
  const uniqueRecipients = Object.fromEntries(
    MARKETING_ANALYTICS_EVENT_TYPES.map((type) => [type, new Set<string>()]),
  ) as Record<MarketingAnalyticsEventType, Set<string>>;
  const rawEventTotals = emptyRawEventTotals();

  for (const event of events) {
    if (!MARKETING_ANALYTICS_EVENT_TYPES.includes(
      event.event_type as MarketingAnalyticsEventType,
    )) {
      continue;
    }
    const eventType = event.event_type as MarketingAnalyticsEventType;
    rawEventTotals[eventType] += 1;
    const recipientKey = event.recipient_id ?? event.id;
    if (recipientKey) uniqueRecipients[eventType].add(recipientKey);
  }

  const delivered = uniqueRecipients.delivered.size;
  const opened = uniqueRecipients.opened.size;
  const clicked = uniqueRecipients.clicked.size;
  const unsubscribed = uniqueRecipients.unsubscribed.size;
  const bounced = uniqueRecipients.bounced.size;
  const complained = uniqueRecipients.complained.size;
  const engagementBase = delivered || sent;

  return {
    sent,
    delivered,
    opened,
    clicked,
    unsubscribed,
    bounced,
    complained,
    openRate: percentage(opened, engagementBase),
    clickRate: percentage(clicked, engagementBase),
    bounceRate: percentage(bounced, sent),
    unsubRate: percentage(unsubscribed, sent),
    complaintRate: percentage(complained, sent),
    rawEventTotals,
  };
}

function applyScope(query: any, scope: AnalyticsScope, dateColumn: string) {
  let scoped = query;
  if (scope.campaignId) scoped = scoped.eq("campaign_id", scope.campaignId);
  if (scope.campaignIds) scoped = scoped.in("campaign_id", scope.campaignIds);
  if (scope.since) scoped = scoped.gte(dateColumn, scope.since);
  return scoped;
}

async function countSentRecipients(
  supabase: unknown,
  scope: AnalyticsScope,
): Promise<number> {
  let query = db(supabase)
    .from("marketing_campaign_recipients")
    .select("id", { count: "exact", head: true })
    .not("sent_at", "is", null);
  query = applyScope(query, scope, "sent_at");
  const result = await query;
  throwIfError(result.error);
  return result.count ?? 0;
}

async function readEvents(
  supabase: unknown,
  scope: AnalyticsScope,
): Promise<MarketingAnalyticsEvent[]> {
  const rows: MarketingAnalyticsEvent[] = [];
  let page = 0;

  while (true) {
    let query = db(supabase)
      .from("marketing_message_events")
      .select("id,recipient_id,event_type")
      .in("event_type", [...MARKETING_ANALYTICS_EVENT_TYPES])
      .order("occurred_at", { ascending: true })
      .range(page * EVENT_PAGE_SIZE, (page + 1) * EVENT_PAGE_SIZE - 1);
    query = applyScope(query, scope, "occurred_at");
    const result = await query;
    throwIfError(result.error);
    const pageRows = (result.data ?? []) as MarketingAnalyticsEvent[];
    rows.push(...pageRows);
    if (pageRows.length < EVENT_PAGE_SIZE) break;
    page += 1;
  }

  return rows;
}

async function getScopedMetrics(
  supabase: unknown,
  scope: AnalyticsScope,
): Promise<MarketingOverviewMetrics> {
  const [sent, events] = await Promise.all([
    countSentRecipients(supabase, scope),
    readEvents(supabase, scope),
  ]);
  return aggregateMarketingMetrics(sent, events);
}

async function getQueueBreakdown(
  supabase: unknown,
  scope: AnalyticsScope,
): Promise<MarketingQueueBreakdown> {
  const queue = emptyQueueBreakdown();
  await Promise.all(MARKETING_RECIPIENT_STATUSES.map(async (status) => {
    let query = db(supabase)
      .from("marketing_campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("status", status);
    query = applyScope(query, scope, "created_at");
    const result = await query;
    throwIfError(result.error);
    queue[status] = result.count ?? 0;
  }));
  return queue;
}

export async function getMarketingOverview(
  supabase: unknown,
  input: { sinceDays?: number } = {},
): Promise<MarketingOverviewMetrics> {
  const sinceDays = input.sinceDays;
  const since = typeof sinceDays === "number"
    ? new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1_000).toISOString()
    : undefined;
  const aggregate = await readAggregateRpc(supabase, "get_marketing_overview_metrics", { p_since: since ?? null });
  if (aggregate !== null) return aggregateRow(aggregate) ?? emptyMarketingMetrics();
  return getScopedMetrics(supabase, { since });
}

export async function getCampaignAnalytics(
  supabase: unknown,
  campaignId: string,
): Promise<MarketingCampaignAnalytics> {
  const aggregate = await readAggregateRpc(supabase, "get_marketing_campaign_metrics", { p_campaign_id: campaignId });
  if (aggregate !== null) {
    const metrics = aggregateRow(aggregate) ?? emptyMarketingMetrics();
    const row = (Array.isArray(aggregate) ? aggregate[0] : aggregate) as Record<string, unknown> | null;
    const count = (key: string) => Number(row?.[key] ?? 0);
    return {
      campaignId,
      ...metrics,
      queue: {
        queued: count("queued_count"),
        sending: count("sending_count"),
        sent: count("recipient_sent_count"),
        failed: count("failed_count"),
        suppressed: count("suppressed_count"),
        skipped: count("skipped_count"),
      },
    };
  }
  const scope = { campaignId };
  const [metrics, queue] = await Promise.all([
    getScopedMetrics(supabase, scope),
    getQueueBreakdown(supabase, scope),
  ]);
  return { campaignId, ...metrics, queue };
}

export async function getSegmentAnalytics(
  supabase: unknown,
  segmentId: string,
): Promise<MarketingSegmentAnalytics> {
  const campaignsResult = await db(supabase)
    .from("marketing_campaigns")
    .select("id")
    .eq("segment_id", segmentId)
    .limit(1_000);
  throwIfError(campaignsResult.error);
  const campaignIds = (campaignsResult.data ?? [])
    .map((campaign: { id?: unknown }) => campaign.id)
    .filter((id: unknown): id is string => typeof id === "string");
  if (campaignIds.length === 0) {
    return {
      segmentId,
      campaignCount: 0,
      ...emptyMarketingMetrics(),
      queue: emptyQueueBreakdown(),
    };
  }

  const scope = { campaignIds };
  const [metrics, queue] = await Promise.all([
    getScopedMetrics(supabase, scope),
    getQueueBreakdown(supabase, scope),
  ]);
  return {
    segmentId,
    campaignCount: campaignIds.length,
    ...metrics,
    queue,
  };
}
