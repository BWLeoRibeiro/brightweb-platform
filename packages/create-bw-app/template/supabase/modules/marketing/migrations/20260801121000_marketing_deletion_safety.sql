-- Serialize destructive campaign operations with delivery state transitions.

CREATE OR REPLACE FUNCTION public.maintain_marketing_campaign_recipient_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.marketing_campaigns
    SET total_recipients = total_recipients + 1
    WHERE id = NEW.campaign_id;
    RETURN NEW;
  END IF;

  UPDATE public.marketing_campaigns
  SET total_recipients = GREATEST(0, total_recipients - 1)
  WHERE id = OLD.campaign_id;
  RETURN OLD;
END;
$$;

UPDATE public.marketing_campaigns campaign
SET total_recipients = (
  SELECT count(*)::integer
  FROM public.marketing_campaign_recipients recipient
  WHERE recipient.campaign_id = campaign.id
);

DROP TRIGGER IF EXISTS trg_maintain_marketing_campaign_recipient_count
  ON public.marketing_campaign_recipients;
CREATE TRIGGER trg_maintain_marketing_campaign_recipient_count
AFTER INSERT OR DELETE ON public.marketing_campaign_recipients
FOR EACH ROW
EXECUTE FUNCTION public.maintain_marketing_campaign_recipient_count();

CREATE OR REPLACE FUNCTION public.delete_marketing_campaign_safely(p_campaign_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status
  FROM public.marketing_campaigns
  WHERE id = p_campaign_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;
  IF v_status NOT IN ('draft', 'canceled') THEN
    RETURN 'invalid_status';
  END IF;

  DELETE FROM public.marketing_campaigns WHERE id = p_campaign_id;
  RETURN 'deleted';
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_marketing_campaign_recipient_safely(
  p_campaign_id uuid,
  p_recipient_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_campaign_status text;
  v_deleted_id uuid;
BEGIN
  SELECT status INTO v_campaign_status
  FROM public.marketing_campaigns
  WHERE id = p_campaign_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'campaign_not_found';
  END IF;
  IF v_campaign_status NOT IN ('draft', 'scheduled', 'canceled') THEN
    RETURN 'campaign_locked';
  END IF;

  DELETE FROM public.marketing_campaign_recipients
  WHERE id = p_recipient_id
    AND campaign_id = p_campaign_id
    AND status IN ('queued', 'suppressed', 'skipped')
  RETURNING id INTO v_deleted_id;

  IF v_deleted_id IS NULL THEN
    RETURN 'recipient_not_deletable';
  END IF;

  RETURN 'deleted';
END;
$$;

REVOKE ALL ON FUNCTION public.maintain_marketing_campaign_recipient_count() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_marketing_campaign_safely(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_marketing_campaign_recipient_safely(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_marketing_campaign_safely(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_marketing_campaign_recipient_safely(uuid, uuid) TO authenticated, service_role;
