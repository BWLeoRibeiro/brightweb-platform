-- Align project activity visibility with the canonical project read policy.
-- Removed members and deleted-project audiences are retained in event payloads.

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
  v_project_id uuid;
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

  IF p_domain <> 'projects' THEN
    RETURN v_role = ANY (ARRAY['staff', 'admin']);
  END IF;

  IF v_role = 'admin' THEN
    RETURN true;
  END IF;

  IF jsonb_typeof(v_payload->'visible_profile_ids') = 'array'
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(v_payload->'visible_profile_ids') AS visible(profile_id)
      WHERE visible.profile_id = p_profile_id::text
    ) THEN
    RETURN true;
  END IF;

  BEGIN
    v_project_id := NULLIF(v_payload->>'project_id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_project_id := NULL;
  END;

  IF v_project_id IS NULL AND p_entity_table = 'projects' THEN
    v_project_id := p_entity_id;
  END IF;
  IF v_project_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.projects project
    WHERE project.id = v_project_id
      AND project.owner_profile_id = p_profile_id
  )
    OR EXISTS (
      SELECT 1
      FROM public.project_members member
      WHERE member.project_id = v_project_id
        AND member.profile_id = p_profile_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.projects project
      JOIN public.organization_members member
        ON member.organization_id = project.organization_id
      WHERE project.id = v_project_id
        AND member.profile_id = p_profile_id
        AND member.role = 'admin'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.can_profile_view_app_activity_event(uuid, text, text, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_profile_view_app_activity_event(uuid, text, text, uuid, jsonb)
  TO service_role;

DROP POLICY IF EXISTS "Project members can view project activity events"
  ON public.app_activity_events;
CREATE POLICY "Project members can view project activity events"
  ON public.app_activity_events
  FOR SELECT
  TO authenticated
  USING (
    domain = 'projects'
    AND public.can_view_app_activity_event(domain, entity_table, entity_id, payload)
  );

CREATE OR REPLACE FUNCTION public.capture_removed_project_member_realtime_audience()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_profile_id text;
  v_visible jsonb;
BEGIN
  IF NEW.domain <> 'projects' OR NEW.event_type <> 'member_removed' THEN
    RETURN NEW;
  END IF;

  v_profile_id := NULLIF(NEW.payload->>'profile_id', '');
  IF v_profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_visible := COALESCE(NEW.payload->'visible_profile_ids', '[]'::jsonb);
  IF jsonb_typeof(v_visible) <> 'array' THEN
    v_visible := '[]'::jsonb;
  END IF;
  IF NOT v_visible @> jsonb_build_array(v_profile_id) THEN
    v_visible := v_visible || jsonb_build_array(v_profile_id);
  END IF;

  NEW.payload := COALESCE(NEW.payload, '{}'::jsonb)
    || jsonb_build_object('visible_profile_ids', v_visible);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS capture_removed_project_member_realtime_audience
  ON public.app_activity_events;
CREATE TRIGGER capture_removed_project_member_realtime_audience
  BEFORE INSERT ON public.app_activity_events
  FOR EACH ROW
  EXECUTE FUNCTION public.capture_removed_project_member_realtime_audience();
