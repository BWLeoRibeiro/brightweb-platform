CREATE OR REPLACE FUNCTION public.get_project_access_configuration(target_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT (
    public.is_admin()
    OR (public.is_staff() AND public.is_project_owner_member(target_project_id))
  ) THEN
    RAISE EXCEPTION 'Only project owners or administrators can view client access configuration.'
      USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'mode', project.client_access_mode,
    'updated_at', project.updated_at,
    'client_summary', project.client_summary,
    'client_scope', project.client_scope,
    'client_contact_profile_id', project.client_contact_profile_id,
    'organizations', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'organization_id', organization.id,
          'organization_name', organization.name,
          'is_primary', participant.is_primary,
          'selected_for_client_access', audience.project_id IS NOT NULL,
          'eligible_clients', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'profile_id', profile.id,
                'label', COALESCE(NULLIF(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''), profile.email),
                'email', profile.email,
                'organization_role', org_member.role
              ) ORDER BY profile.first_name, profile.last_name, profile.email
            )
            FROM public.organization_members org_member
            JOIN public.profiles profile ON profile.id = org_member.profile_id AND profile.user_id IS NOT NULL
            JOIN public.user_role_assignments role_assignment
              ON role_assignment.profile_id = profile.id AND role_assignment.role_code = 'client'
            WHERE org_member.organization_id = organization.id
          ), '[]'::jsonb),
          'selected_profile_ids', COALESCE((
            SELECT jsonb_agg(client_profile.profile_id ORDER BY client_profile.profile_id)
            FROM public.project_client_profiles client_profile
            WHERE client_profile.project_id = target_project_id
              AND client_profile.organization_id = organization.id
          ), '[]'::jsonb)
        ) ORDER BY participant.is_primary DESC, organization.name
      )
      FROM public.project_organizations participant
      JOIN public.organizations organization ON organization.id = participant.organization_id
      LEFT JOIN public.project_client_organizations audience
        ON audience.project_id = participant.project_id
       AND audience.organization_id = participant.organization_id
      WHERE participant.project_id = target_project_id
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM public.projects project
  WHERE project.id = target_project_id;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Projeto não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_project_access_configuration(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_project_access_configuration(uuid)
  TO authenticated;
