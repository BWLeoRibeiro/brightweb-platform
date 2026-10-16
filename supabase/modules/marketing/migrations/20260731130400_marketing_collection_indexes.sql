-- Support paginated top-bar search and status filters across Marketing.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS marketing_campaigns_name_trgm_idx
  ON public.marketing_campaigns USING gin (name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS marketing_campaigns_subject_trgm_idx
  ON public.marketing_campaigns USING gin (subject extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS marketing_campaigns_status_created_idx
  ON public.marketing_campaigns (status, created_at DESC);
CREATE INDEX IF NOT EXISTS marketing_campaigns_created_idx
  ON public.marketing_campaigns (created_at DESC);
CREATE INDEX IF NOT EXISTS marketing_segments_name_trgm_idx
  ON public.marketing_segments USING gin (name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS marketing_segments_description_trgm_idx
  ON public.marketing_segments USING gin (description extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS marketing_workflows_name_trgm_idx
  ON public.marketing_workflows USING gin (name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS marketing_workflows_description_trgm_idx
  ON public.marketing_workflows USING gin (description extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS marketing_workflows_status_created_idx
  ON public.marketing_workflows (status, created_at DESC);
CREATE INDEX IF NOT EXISTS marketing_workflows_created_idx
  ON public.marketing_workflows (created_at DESC);
CREATE INDEX IF NOT EXISTS marketing_message_events_campaign_occurred_idx
  ON public.marketing_message_events (campaign_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION public.get_marketing_overview_metrics(p_since timestamptz DEFAULT NULL)
RETURNS TABLE (
  sent_count bigint,
  delivered_count bigint,
  opened_count bigint,
  clicked_count bigint,
  unsubscribed_count bigint,
  bounced_count bigint,
  complained_count bigint,
  raw_sent_count bigint,
  raw_delivered_count bigint,
  raw_opened_count bigint,
  raw_clicked_count bigint,
  raw_unsubscribed_count bigint,
  raw_bounced_count bigint,
  raw_complained_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH recipient_counts AS (
    SELECT count(*) AS sent_count
    FROM public.marketing_campaign_recipients
    WHERE sent_at IS NOT NULL AND (p_since IS NULL OR sent_at >= p_since)
  ),
  event_counts AS (
    SELECT
      count(DISTINCT coalesce(recipient_id::text, id::text)) FILTER (WHERE event_type = 'delivered') AS delivered_count,
      count(DISTINCT coalesce(recipient_id::text, id::text)) FILTER (WHERE event_type = 'opened') AS opened_count,
      count(DISTINCT coalesce(recipient_id::text, id::text)) FILTER (WHERE event_type = 'clicked') AS clicked_count,
      count(DISTINCT coalesce(recipient_id::text, id::text)) FILTER (WHERE event_type = 'unsubscribed') AS unsubscribed_count,
      count(DISTINCT coalesce(recipient_id::text, id::text)) FILTER (WHERE event_type = 'bounced') AS bounced_count,
      count(DISTINCT coalesce(recipient_id::text, id::text)) FILTER (WHERE event_type = 'complained') AS complained_count,
      count(*) FILTER (WHERE event_type = 'sent') AS raw_sent_count,
      count(*) FILTER (WHERE event_type = 'delivered') AS raw_delivered_count,
      count(*) FILTER (WHERE event_type = 'opened') AS raw_opened_count,
      count(*) FILTER (WHERE event_type = 'clicked') AS raw_clicked_count,
      count(*) FILTER (WHERE event_type = 'unsubscribed') AS raw_unsubscribed_count,
      count(*) FILTER (WHERE event_type = 'bounced') AS raw_bounced_count,
      count(*) FILTER (WHERE event_type = 'complained') AS raw_complained_count
    FROM public.marketing_message_events
    WHERE (p_since IS NULL OR occurred_at >= p_since)
  )
  SELECT recipients.sent_count, events.*
  FROM recipient_counts recipients CROSS JOIN event_counts events;
$$;

CREATE OR REPLACE FUNCTION public.get_marketing_campaign_metrics(p_campaign_id uuid)
RETURNS TABLE (
  sent_count bigint,
  delivered_count bigint,
  opened_count bigint,
  clicked_count bigint,
  unsubscribed_count bigint,
  bounced_count bigint,
  complained_count bigint,
  raw_sent_count bigint,
  raw_delivered_count bigint,
  raw_opened_count bigint,
  raw_clicked_count bigint,
  raw_unsubscribed_count bigint,
  raw_bounced_count bigint,
  raw_complained_count bigint,
  queued_count bigint,
  sending_count bigint,
  recipient_sent_count bigint,
  failed_count bigint,
  suppressed_count bigint,
  skipped_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH recipient_counts AS (
    SELECT
      count(*) FILTER (WHERE sent_at IS NOT NULL) AS sent_count,
      count(*) FILTER (WHERE status = 'queued') AS queued_count,
      count(*) FILTER (WHERE status = 'sending') AS sending_count,
      count(*) FILTER (WHERE status = 'sent') AS recipient_sent_count,
      count(*) FILTER (WHERE status = 'failed') AS failed_count,
      count(*) FILTER (WHERE status = 'suppressed') AS suppressed_count,
      count(*) FILTER (WHERE status = 'skipped') AS skipped_count
    FROM public.marketing_campaign_recipients
    WHERE campaign_id = p_campaign_id
  ),
  event_counts AS (
    SELECT
      count(DISTINCT coalesce(recipient_id::text, id::text)) FILTER (WHERE event_type = 'delivered') AS delivered_count,
      count(DISTINCT coalesce(recipient_id::text, id::text)) FILTER (WHERE event_type = 'opened') AS opened_count,
      count(DISTINCT coalesce(recipient_id::text, id::text)) FILTER (WHERE event_type = 'clicked') AS clicked_count,
      count(DISTINCT coalesce(recipient_id::text, id::text)) FILTER (WHERE event_type = 'unsubscribed') AS unsubscribed_count,
      count(DISTINCT coalesce(recipient_id::text, id::text)) FILTER (WHERE event_type = 'bounced') AS bounced_count,
      count(DISTINCT coalesce(recipient_id::text, id::text)) FILTER (WHERE event_type = 'complained') AS complained_count,
      count(*) FILTER (WHERE event_type = 'sent') AS raw_sent_count,
      count(*) FILTER (WHERE event_type = 'delivered') AS raw_delivered_count,
      count(*) FILTER (WHERE event_type = 'opened') AS raw_opened_count,
      count(*) FILTER (WHERE event_type = 'clicked') AS raw_clicked_count,
      count(*) FILTER (WHERE event_type = 'unsubscribed') AS raw_unsubscribed_count,
      count(*) FILTER (WHERE event_type = 'bounced') AS raw_bounced_count,
      count(*) FILTER (WHERE event_type = 'complained') AS raw_complained_count
    FROM public.marketing_message_events
    WHERE campaign_id = p_campaign_id
  )
  SELECT
    recipients.sent_count,
    events.delivered_count,
    events.opened_count,
    events.clicked_count,
    events.unsubscribed_count,
    events.bounced_count,
    events.complained_count,
    events.raw_sent_count,
    events.raw_delivered_count,
    events.raw_opened_count,
    events.raw_clicked_count,
    events.raw_unsubscribed_count,
    events.raw_bounced_count,
    events.raw_complained_count,
    recipients.queued_count,
    recipients.sending_count,
    recipients.recipient_sent_count,
    recipients.failed_count,
    recipients.suppressed_count,
    recipients.skipped_count
  FROM recipient_counts recipients CROSS JOIN event_counts events;
$$;

REVOKE ALL ON FUNCTION public.get_marketing_overview_metrics(timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_marketing_campaign_metrics(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_marketing_overview_metrics(timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_marketing_campaign_metrics(uuid) TO service_role;
