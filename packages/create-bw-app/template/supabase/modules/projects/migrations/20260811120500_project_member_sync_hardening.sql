-- Make project team and owner changes a single explicitly authorized operation.

CREATE OR REPLACE FUNCTION public.sync_project_members_exact(
  p_project_id uuid,
  p_members jsonb,
  p_owner_profile_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_profile_id uuid := public.current_profile_id();
  v_current_owner_profile_id uuid;
  v_client_contact_profile_id uuid;
  v_members jsonb := COALESCE(p_members, '[]'::jsonb);
BEGIN
  IF jsonb_typeof(v_members) <> 'array' THEN
    RAISE EXCEPTION 'Project members must be a JSON array.' USING ERRCODE = '22023';
  END IF;

  SELECT project.owner_profile_id, project.client_contact_profile_id
  INTO v_current_owner_profile_id, v_client_contact_profile_id
  FROM public.projects project
  WHERE project.id = p_project_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projeto não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    public.is_admin()
    OR (
      public.is_staff()
      AND (
        v_current_owner_profile_id = v_actor_profile_id
        OR EXISTS (
          SELECT 1
          FROM public.project_members member
          WHERE member.project_id = p_project_id
            AND member.profile_id = v_actor_profile_id
            AND member.role = 'owner'
        )
      )
    )
  ) THEN
    RAISE EXCEPTION 'Only project owners or administrators can manage the internal project team.'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(v_members) AS member(profile_id uuid, role text)
    WHERE member.profile_id IS NULL
      OR member.role NOT IN ('owner', 'contributor', 'observer')
  ) THEN
    RAISE EXCEPTION 'Every project member requires a valid profile and role.'
      USING ERRCODE = '22023';
  END IF;

  IF (
    SELECT count(*) <> count(DISTINCT member.profile_id)
    FROM jsonb_to_recordset(v_members) AS member(profile_id uuid, role text)
  ) THEN
    RAISE EXCEPTION 'Each internal profile can appear only once in the project team.'
      USING ERRCODE = '22023';
  END IF;

  IF (SELECT count(*) FROM jsonb_to_recordset(v_members) AS member(profile_id uuid, role text) WHERE member.role = 'owner') <> 1
    OR NOT EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(v_members) AS member(profile_id uuid, role text)
      WHERE member.profile_id = p_owner_profile_id
        AND member.role = 'owner'
    ) THEN
    RAISE EXCEPTION 'Exactly one internal project owner is required and must match the project owner.'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(v_members) AS member(profile_id uuid, role text)
    LEFT JOIN public.user_role_assignments role_assignment
      ON role_assignment.profile_id = member.profile_id
     AND role_assignment.role_code IN ('staff', 'admin')
    WHERE role_assignment.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Project members must be internal staff.' USING ERRCODE = '22023';
  END IF;

  IF v_client_contact_profile_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(v_members) AS member(profile_id uuid, role text)
    WHERE member.profile_id = v_client_contact_profile_id
  ) THEN
    RAISE EXCEPTION 'The responsible client contact must remain in the internal project team.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.project_members(project_id, profile_id, role)
  SELECT p_project_id, member.profile_id, member.role
  FROM jsonb_to_recordset(v_members) AS member(profile_id uuid, role text)
  ON CONFLICT (project_id, profile_id) DO UPDATE SET role = EXCLUDED.role;

  DELETE FROM public.project_members existing
  WHERE existing.project_id = p_project_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(v_members) AS member(profile_id uuid, role text)
      WHERE member.profile_id = existing.profile_id
    );

  UPDATE public.projects
  SET owner_profile_id = p_owner_profile_id
  WHERE id = p_project_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_project_members_exact(uuid, jsonb, uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.sync_project_members_exact(uuid, jsonb, uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_internal_project_role_downgrade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role_code IN ('staff', 'admin')
    AND (TG_OP = 'DELETE' OR NEW.role_code NOT IN ('staff', 'admin'))
    AND (
      EXISTS (
        SELECT 1 FROM public.projects project
        WHERE project.owner_profile_id = OLD.profile_id
      )
      OR EXISTS (
        SELECT 1 FROM public.project_members member
        WHERE member.profile_id = OLD.profile_id
      )
    ) THEN
    RAISE EXCEPTION 'Reassign or remove this profile from every project before changing its role to client.'
      USING ERRCODE = '23514';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_internal_project_role_downgrade
  ON public.user_role_assignments;
CREATE TRIGGER trg_prevent_internal_project_role_downgrade
BEFORE UPDATE OF role_code OR DELETE ON public.user_role_assignments
FOR EACH ROW
EXECUTE FUNCTION public.prevent_internal_project_role_downgrade();
