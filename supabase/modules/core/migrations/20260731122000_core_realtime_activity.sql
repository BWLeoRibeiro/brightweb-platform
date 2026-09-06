-- Keep the notification list useful after acknowledgement. The unread summary
-- still uses alerts_seen_at; the item list returns the latest visible events.

DROP FUNCTION IF EXISTS public.current_notification_items(uuid, integer);

CREATE OR REPLACE FUNCTION public.current_notification_items(
  p_profile_id uuid,
  p_limit integer DEFAULT 8
)
RETURNS TABLE(
  id uuid,
  created_at timestamptz,
  domain text,
  event_type text,
  entity_table text,
  entity_id uuid,
  actor_profile_id uuid,
  summary text,
  payload jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    event.id,
    event.created_at,
    event.domain,
    event.event_type,
    event.entity_table,
    event.entity_id,
    event.actor_profile_id,
    event.summary,
    COALESCE(event.payload, '{}'::jsonb)
  FROM public.app_activity_events event
  WHERE public.can_profile_view_app_activity_event(
      p_profile_id,
      event.domain,
      event.entity_table,
      event.entity_id,
      event.payload
    )
    AND (event.actor_profile_id IS NULL OR event.actor_profile_id <> p_profile_id)
  ORDER BY event.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 8), 0), 50)
$$;

REVOKE ALL ON FUNCTION public.current_notification_items(uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_notification_items(uuid, integer)
  TO service_role;
