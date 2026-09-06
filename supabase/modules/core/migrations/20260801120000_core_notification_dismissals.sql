-- Per-profile notification dismissal without deleting shared audit events.

CREATE TABLE IF NOT EXISTS public.user_notification_dismissals (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_event_id uuid NOT NULL REFERENCES public.app_activity_events(id) ON DELETE CASCADE,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, activity_event_id)
);

ALTER TABLE public.user_notification_dismissals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_notification_dismissals FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.user_notification_dismissals TO service_role;

CREATE OR REPLACE FUNCTION public.current_notification_summary(p_profile_id uuid)
RETURNS TABLE(seen_at timestamptz, unread_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH notification_state AS (
    SELECT state.alerts_seen_at FROM public.user_notification_state state
    WHERE state.profile_id = p_profile_id LIMIT 1
  )
  SELECT (SELECT alerts_seen_at FROM notification_state), count(event.id)
  FROM public.app_activity_events event
  WHERE public.can_profile_view_app_activity_event(p_profile_id, event.domain, event.entity_table, event.entity_id, event.payload)
    AND ((SELECT alerts_seen_at FROM notification_state) IS NULL OR event.created_at > (SELECT alerts_seen_at FROM notification_state))
    AND (event.actor_profile_id IS NULL OR event.actor_profile_id <> p_profile_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_notification_dismissals dismissal
      WHERE dismissal.profile_id = p_profile_id AND dismissal.activity_event_id = event.id
    )
$$;

DROP FUNCTION IF EXISTS public.current_notification_items(uuid, integer);
CREATE FUNCTION public.current_notification_items(p_profile_id uuid, p_limit integer DEFAULT 8)
RETURNS TABLE(id uuid, created_at timestamptz, domain text, event_type text, entity_table text, entity_id uuid, actor_profile_id uuid, summary text, payload jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT event.id, event.created_at, event.domain, event.event_type, event.entity_table,
    event.entity_id, event.actor_profile_id, event.summary, COALESCE(event.payload, '{}'::jsonb)
  FROM public.app_activity_events event
  WHERE public.can_profile_view_app_activity_event(p_profile_id, event.domain, event.entity_table, event.entity_id, event.payload)
    AND (event.actor_profile_id IS NULL OR event.actor_profile_id <> p_profile_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_notification_dismissals dismissal
      WHERE dismissal.profile_id = p_profile_id AND dismissal.activity_event_id = event.id
    )
  ORDER BY event.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 8), 0), 50)
$$;

CREATE OR REPLACE FUNCTION public.dismiss_current_notifications(p_profile_id uuid, p_activity_event_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  IF p_activity_event_id IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO public.user_notification_dismissals(profile_id, activity_event_id)
  SELECT p_profile_id, event.id
  FROM public.app_activity_events event
  WHERE event.id = p_activity_event_id
    AND public.can_profile_view_app_activity_event(p_profile_id, event.domain, event.entity_table, event.entity_id, event.payload)
    AND (event.actor_profile_id IS NULL OR event.actor_profile_id <> p_profile_id)
  ON CONFLICT (profile_id, activity_event_id) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.current_notification_summary(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_notification_items(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dismiss_current_notifications(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_notification_summary(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.current_notification_items(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.dismiss_current_notifications(uuid, uuid) TO service_role;
