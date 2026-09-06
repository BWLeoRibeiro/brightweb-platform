-- Apply exact project membership and owner changes in one serialized transaction.

CREATE OR REPLACE FUNCTION public.sync_project_members_exact(
  p_project_id uuid,
  p_members jsonb,
  p_owner_profile_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF jsonb_typeof(COALESCE(p_members, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Project members must be a JSON array.' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projeto não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.project_members(project_id, profile_id, role)
  SELECT p_project_id, member.profile_id, member.role
  FROM jsonb_to_recordset(COALESCE(p_members, '[]'::jsonb))
    AS member(profile_id uuid, role text)
  ON CONFLICT (project_id, profile_id) DO UPDATE SET role = EXCLUDED.role;

  DELETE FROM public.project_members existing
  WHERE existing.project_id = p_project_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(COALESCE(p_members, '[]'::jsonb))
        AS member(profile_id uuid, role text)
      WHERE member.profile_id = existing.profile_id
    );

  UPDATE public.projects
  SET owner_profile_id = p_owner_profile_id
  WHERE id = p_project_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_project_members_exact(uuid, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_project_members_exact(uuid, jsonb, uuid) TO authenticated, service_role;
