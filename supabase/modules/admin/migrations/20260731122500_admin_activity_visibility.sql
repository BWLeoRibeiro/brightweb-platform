-- Admin activity is visible only to admins. Other non-project activity remains
-- visible to staff/admin; the Projects module installs its own audience rules.

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
  v_role text;
BEGIN
  IF p_profile_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT assignment.role_code
  INTO v_role
  FROM public.user_role_assignments assignment
  WHERE assignment.profile_id = p_profile_id
  LIMIT 1;

  IF p_domain = 'admin' THEN
    RETURN v_role = 'admin';
  END IF;

  RETURN v_role = ANY (ARRAY['staff', 'admin']);
END;
$$;

REVOKE ALL ON FUNCTION public.can_profile_view_app_activity_event(uuid, text, text, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_profile_view_app_activity_event(uuid, text, text, uuid, jsonb)
  TO service_role;

DROP POLICY IF EXISTS "Staff can view app activity events" ON public.app_activity_events;
CREATE POLICY "Staff can view app activity events"
  ON public.app_activity_events
  FOR SELECT
  TO authenticated
  USING (
    public.is_staff()
    AND public.can_view_app_activity_event(domain, entity_table, entity_id, payload)
  );
