-- Extend the Core notification audience contract with project membership rules.

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

  IF p_domain <> 'projects' THEN
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
    FROM public.user_role_assignments assignment
    WHERE assignment.profile_id = p_profile_id
      AND assignment.role_code = 'admin'
  )
    OR EXISTS (
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
    );
END;
$$;

REVOKE ALL ON FUNCTION public.can_profile_view_app_activity_event(uuid, text, text, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_profile_view_app_activity_event(uuid, text, text, uuid, jsonb)
  TO service_role;
