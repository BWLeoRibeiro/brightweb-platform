-- Shared notification inbox primitives. Module-specific migrations may replace
-- can_profile_view_app_activity_event to add audience rules for their domains.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'app_activity_events'
    )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_activity_events;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_profile_view_app_activity_event(
  p_profile_id uuid,
  p_domain text,
  p_entity_table text,
  p_entity_id uuid,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload jsonb := COALESCE(p_payload, '{}'::jsonb);
BEGIN
  IF p_profile_id IS NULL THEN
    RETURN false;
  END IF;

  IF jsonb_typeof(v_payload->'visible_profile_ids') = 'array' THEN
    RETURN EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(v_payload->'visible_profile_ids') AS visible(profile_id)
      WHERE visible.profile_id = p_profile_id::text
    );
  END IF;

  -- Project audience rules are installed by the projects module.
  RETURN p_domain <> 'projects';
END;
$$;

REVOKE ALL ON FUNCTION public.can_profile_view_app_activity_event(uuid, text, text, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_profile_view_app_activity_event(uuid, text, text, uuid, jsonb)
  TO service_role;

CREATE OR REPLACE FUNCTION public.can_view_app_activity_event(
  p_domain text,
  p_entity_table text,
  p_entity_id uuid,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_profile_view_app_activity_event(
    public.current_profile_id(),
    p_domain,
    p_entity_table,
    p_entity_id,
    p_payload
  )
$$;

REVOKE ALL ON FUNCTION public.can_view_app_activity_event(text, text, uuid, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_app_activity_event(text, text, uuid, jsonb)
  TO authenticated;

DROP POLICY IF EXISTS "Staff can view app activity events" ON public.app_activity_events;
CREATE POLICY "Staff can view app activity events"
  ON public.app_activity_events
  FOR SELECT
  TO authenticated
  USING (
    public.is_staff()
    AND public.can_view_app_activity_event(domain, entity_table, entity_id, payload)
  );

CREATE OR REPLACE FUNCTION public.current_notification_summary(p_profile_id uuid)
RETURNS TABLE(seen_at timestamptz, unread_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH notification_state AS (
    SELECT state.alerts_seen_at
    FROM public.user_notification_state state
    WHERE state.profile_id = p_profile_id
    LIMIT 1
  )
  SELECT
    (SELECT alerts_seen_at FROM notification_state) AS seen_at,
    count(event.id) AS unread_count
  FROM public.app_activity_events event
  WHERE public.can_profile_view_app_activity_event(
      p_profile_id,
      event.domain,
      event.entity_table,
      event.entity_id,
      event.payload
    )
    AND (
      (SELECT alerts_seen_at FROM notification_state) IS NULL
      OR event.created_at > (SELECT alerts_seen_at FROM notification_state)
    )
    AND (event.actor_profile_id IS NULL OR event.actor_profile_id <> p_profile_id)
$$;

REVOKE ALL ON FUNCTION public.current_notification_summary(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_notification_summary(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.current_notification_items(
  p_profile_id uuid,
  p_limit integer DEFAULT 8
)
RETURNS TABLE(
  id uuid,
  created_at timestamptz,
  domain text,
  summary text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT event.id, event.created_at, event.domain, event.summary
  FROM public.app_activity_events event
  LEFT JOIN public.user_notification_state state
    ON state.profile_id = p_profile_id
  WHERE public.can_profile_view_app_activity_event(
      p_profile_id,
      event.domain,
      event.entity_table,
      event.entity_id,
      event.payload
    )
    AND (state.alerts_seen_at IS NULL OR event.created_at > state.alerts_seen_at)
    AND (event.actor_profile_id IS NULL OR event.actor_profile_id <> p_profile_id)
  ORDER BY event.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 8), 0), 50)
$$;

REVOKE ALL ON FUNCTION public.current_notification_items(uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_notification_items(uuid, integer)
  TO service_role;
