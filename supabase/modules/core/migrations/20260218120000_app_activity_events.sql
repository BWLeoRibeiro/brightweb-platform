-- Global app activity event bus for Brightweb modules.

CREATE TABLE IF NOT EXISTS public.app_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  domain text NOT NULL,
  event_type text NOT NULL,
  entity_table text NOT NULL,
  entity_id uuid,
  actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  summary text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_app_activity_events_created_at_desc
  ON public.app_activity_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_activity_events_domain_created_at_desc
  ON public.app_activity_events (domain, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_activity_events_entity
  ON public.app_activity_events (entity_table, entity_id);

CREATE INDEX IF NOT EXISTS idx_app_activity_events_actor_profile
  ON public.app_activity_events (actor_profile_id);

ALTER TABLE public.app_activity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view app activity events" ON public.app_activity_events;
CREATE POLICY "Staff can view app activity events"
  ON public.app_activity_events
  FOR SELECT
  TO authenticated
  USING (public.is_staff());

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS alerts_seen_at timestamptz;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'user_role_assignments'
  ) THEN
    UPDATE public.profiles p
    SET alerts_seen_at = now()
    WHERE p.alerts_seen_at IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.user_role_assignments ura
        WHERE ura.profile_id = p.id
          AND ura.role_code IN ('staff', 'admin')
      );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_app_activity_event(
  p_domain text,
  p_event_type text,
  p_entity_table text,
  p_entity_id uuid,
  p_summary text,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_actor_profile_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_profile_id uuid;
BEGIN
  v_actor_profile_id := COALESCE(p_actor_profile_id, public.current_profile_id());

  INSERT INTO public.app_activity_events (
    domain,
    event_type,
    entity_table,
    entity_id,
    actor_profile_id,
    summary,
    payload
  )
  VALUES (
    p_domain,
    p_event_type,
    p_entity_table,
    p_entity_id,
    v_actor_profile_id,
    p_summary,
    COALESCE(p_payload, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_app_activity_event(text, text, text, uuid, text, jsonb, uuid)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_app_activity_event(text, text, text, uuid, text, jsonb, uuid)
  FROM anon;
REVOKE ALL ON FUNCTION public.log_app_activity_event(text, text, text, uuid, text, jsonb, uuid)
  FROM authenticated;
GRANT EXECUTE ON FUNCTION public.log_app_activity_event(text, text, text, uuid, text, jsonb, uuid)
  TO service_role;
