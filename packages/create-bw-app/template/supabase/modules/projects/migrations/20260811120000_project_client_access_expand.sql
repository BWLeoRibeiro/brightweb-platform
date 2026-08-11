-- Expand the project model with explicit participation, client-safe content,
-- atomic creation, and narrow authenticated client read contracts.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS client_summary text,
  ADD COLUMN IF NOT EXISTS client_scope text,
  ADD COLUMN IF NOT EXISTS client_contact_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_next_steps text;

CREATE INDEX IF NOT EXISTS idx_projects_client_contact_profile_id
  ON public.projects (client_contact_profile_id)
  WHERE client_contact_profile_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.project_organizations (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  added_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, organization_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_organizations_one_primary
  ON public.project_organizations (project_id)
  WHERE is_primary;

CREATE INDEX IF NOT EXISTS idx_project_organizations_org_project
  ON public.project_organizations (organization_id, project_id);

ALTER TABLE public.project_organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project staff view participating organizations"
  ON public.project_organizations;
CREATE POLICY "Project staff view participating organizations"
  ON public.project_organizations
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR (
      public.is_staff()
      AND (
        public.is_project_team_member(project_id)
        OR public.is_project_org_admin(project_id)
      )
    )
  );

DROP POLICY IF EXISTS "Project owners manage participating organizations"
  ON public.project_organizations;
CREATE POLICY "Project owners manage participating organizations"
  ON public.project_organizations
  FOR ALL
  TO authenticated
  USING (
    public.is_admin()
    OR (public.is_staff() AND public.is_project_owner_member(project_id))
  )
  WITH CHECK (
    public.is_admin()
    OR (public.is_staff() AND public.is_project_owner_member(project_id))
  );

INSERT INTO public.project_organizations (project_id, organization_id, is_primary)
SELECT project.id, project.organization_id, true
FROM public.projects project
ON CONFLICT (project_id, organization_id)
DO UPDATE SET is_primary = true;

-- Preserve any audience already configured before participation became
-- explicit. These rows are participants, but are never promoted to primary.
INSERT INTO public.project_organizations (project_id, organization_id, is_primary)
SELECT audience.project_id, audience.organization_id, false
FROM public.project_client_organizations audience
ON CONFLICT (project_id, organization_id) DO NOTHING;

ALTER TABLE public.project_client_organizations
  DROP CONSTRAINT IF EXISTS project_client_organizations_participation_fkey;
ALTER TABLE public.project_client_organizations
  ADD CONSTRAINT project_client_organizations_participation_fkey
  FOREIGN KEY (project_id, organization_id)
  REFERENCES public.project_organizations(project_id, organization_id)
  ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.sync_project_primary_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.project_organizations
  SET is_primary = false
  WHERE project_id = NEW.id
    AND is_primary;

  INSERT INTO public.project_organizations (
    project_id,
    organization_id,
    is_primary,
    added_by_profile_id
  )
  VALUES (
    NEW.id,
    NEW.organization_id,
    true,
    public.current_profile_id()
  )
  ON CONFLICT (project_id, organization_id)
  DO UPDATE SET is_primary = true;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_project_primary_organization ON public.projects;
CREATE TRIGGER trg_sync_project_primary_organization
AFTER INSERT OR UPDATE OF organization_id ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.sync_project_primary_organization();

CREATE TABLE IF NOT EXISTS public.project_creation_requests (
  request_id uuid PRIMARY KEY,
  actor_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  request_payload jsonb NOT NULL,
  project_id uuid NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_creation_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_creation_requests FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_project_organizations(
  target_project_id uuid,
  target_organization_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_profile_id uuid := public.current_profile_id();
  v_primary_organization_id uuid;
  v_organization_ids uuid[] := COALESCE(target_organization_ids, ARRAY[]::uuid[]);
  v_previous_organization_ids uuid[];
BEGIN
  SELECT project.organization_id
  INTO v_primary_organization_id
  FROM public.projects project
  WHERE project.id = target_project_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projeto não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    public.is_admin()
    OR (public.is_staff() AND public.is_project_owner_member(target_project_id))
  ) THEN
    RAISE EXCEPTION 'Only project owners or administrators can manage participating organizations.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT (v_primary_organization_id = ANY(v_organization_ids)) THEN
    RAISE EXCEPTION 'The primary organization must remain a project participant.'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(v_organization_ids) AS selected(organization_id)
    LEFT JOIN public.organizations organization ON organization.id = selected.organization_id
    WHERE selected.organization_id IS NULL OR organization.id IS NULL
  ) THEN
    RAISE EXCEPTION 'One or more participating organizations do not exist.'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(participant.organization_id ORDER BY participant.organization_id), ARRAY[]::uuid[])
  INTO v_previous_organization_ids
  FROM public.project_organizations participant
  WHERE participant.project_id = target_project_id;

  DELETE FROM public.project_organizations participant
  WHERE participant.project_id = target_project_id
    AND NOT (participant.organization_id = ANY(v_organization_ids));

  -- Participation deletion cascades matching client audiences and grants. If
  -- that leaves a visible mode with no coherent audience, fail closed in the
  -- same project-locked transaction instead of retaining a misleading mode.
  IF EXISTS (
    SELECT 1
    FROM public.projects project
    WHERE project.id = target_project_id
      AND project.client_access_mode <> 'hidden'
      AND (
        NOT EXISTS (
          SELECT 1
          FROM public.project_client_organizations audience
          WHERE audience.project_id = target_project_id
        )
        OR (
          project.client_access_mode = 'selected_clients'
          AND EXISTS (
            SELECT 1
            FROM public.project_client_organizations audience
            WHERE audience.project_id = target_project_id
              AND NOT EXISTS (
                SELECT 1
                FROM public.project_client_profiles client_profile
                WHERE client_profile.project_id = audience.project_id
                  AND client_profile.organization_id = audience.organization_id
              )
          )
        )
      )
  ) THEN
    DELETE FROM public.project_client_organizations audience
    WHERE audience.project_id = target_project_id;

    UPDATE public.projects
    SET client_access_mode = 'hidden'
    WHERE id = target_project_id;
  END IF;

  INSERT INTO public.project_organizations (
    project_id,
    organization_id,
    is_primary,
    added_by_profile_id
  )
  SELECT
    target_project_id,
    selected.organization_id,
    selected.organization_id = v_primary_organization_id,
    v_actor_profile_id
  FROM (
    SELECT DISTINCT organization_id
    FROM unnest(v_organization_ids) AS requested(organization_id)
  ) selected
  ON CONFLICT ON CONSTRAINT project_organizations_pkey
  DO UPDATE SET is_primary = EXCLUDED.is_primary;

  INSERT INTO public.app_activity_events (
    domain, event_type, entity_table, entity_id, actor_profile_id, summary, payload
  )
  VALUES (
    'projects',
    'project_organizations_changed',
    'projects',
    target_project_id,
    v_actor_profile_id,
    'Organizações do projeto atualizadas.',
    jsonb_build_object(
      'project_id', target_project_id,
      'previous_organization_ids', to_jsonb(v_previous_organization_ids),
      'organization_ids', to_jsonb(v_organization_ids)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_project_organizations(uuid, uuid[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_project_organizations(uuid, uuid[])
  TO authenticated;

CREATE OR REPLACE FUNCTION public.set_project_client_access(
  target_project_id uuid,
  target_mode text,
  target_organization_ids uuid[],
  target_profile_grants jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_profile_id uuid := public.current_profile_id();
  v_organization_ids uuid[] := COALESCE(target_organization_ids, ARRAY[]::uuid[]);
  v_profile_grants jsonb := COALESCE(target_profile_grants, '[]'::jsonb);
  v_previous_mode text;
  v_previous_organization_ids uuid[];
  v_previous_profile_grants jsonb;
BEGIN
  IF target_mode IS NULL
    OR target_mode NOT IN ('hidden', 'all_org_clients', 'selected_clients') THEN
    RAISE EXCEPTION 'Invalid project client access mode.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_profile_grants) <> 'array' THEN
    RAISE EXCEPTION 'Profile grants must be a JSON array.' USING ERRCODE = '22023';
  END IF;

  SELECT project.client_access_mode
  INTO v_previous_mode
  FROM public.projects project
  WHERE project.id = target_project_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projeto não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    public.is_admin()
    OR (public.is_staff() AND public.is_project_owner_member(target_project_id))
  ) THEN
    RAISE EXCEPTION 'Only project owners or administrators can manage client project access.'
      USING ERRCODE = '42501';
  END IF;

  IF target_mode <> 'hidden' AND cardinality(v_organization_ids) = 0 THEN
    RAISE EXCEPTION 'Visible client access requires at least one organization.'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(v_organization_ids) AS selected(organization_id)
    LEFT JOIN public.project_organizations participant
      ON participant.project_id = target_project_id
     AND participant.organization_id = selected.organization_id
    WHERE selected.organization_id IS NULL OR participant.project_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Every client organization must participate in the project.'
      USING ERRCODE = '22023';
  END IF;

  IF target_mode = 'selected_clients' AND jsonb_array_length(v_profile_grants) = 0 THEN
    RAISE EXCEPTION 'Selected-clients mode requires at least one profile grant.'
      USING ERRCODE = '22023';
  END IF;

  IF target_mode = 'selected_clients' AND EXISTS (
    SELECT 1
    FROM unnest(v_organization_ids) AS selected(organization_id)
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(v_profile_grants)
        AS access_grant(organization_id uuid, profile_id uuid)
      WHERE access_grant.organization_id = selected.organization_id
    )
  ) THEN
    RAISE EXCEPTION 'Every selected organization requires at least one selected client.'
      USING ERRCODE = '22023';
  END IF;

  IF target_mode = 'selected_clients' AND EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(v_profile_grants)
      AS access_grant(organization_id uuid, profile_id uuid)
    LEFT JOIN public.organization_members org_member
      ON org_member.organization_id = access_grant.organization_id
     AND org_member.profile_id = access_grant.profile_id
    LEFT JOIN public.user_role_assignments role_assignment
      ON role_assignment.profile_id = access_grant.profile_id
     AND role_assignment.role_code = 'client'
    LEFT JOIN public.profiles profile
      ON profile.id = access_grant.profile_id
     AND profile.user_id IS NOT NULL
    WHERE access_grant.organization_id IS NULL
      OR access_grant.profile_id IS NULL
      OR NOT (access_grant.organization_id = ANY(v_organization_ids))
      OR org_member.id IS NULL
      OR role_assignment.id IS NULL
      OR profile.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Every selected profile must be an active client member with a login.'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(audience.organization_id ORDER BY audience.organization_id), ARRAY[]::uuid[])
  INTO v_previous_organization_ids
  FROM public.project_client_organizations audience
  WHERE audience.project_id = target_project_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'organization_id', client_profile.organization_id,
        'profile_id', client_profile.profile_id
      ) ORDER BY client_profile.organization_id, client_profile.profile_id
    ),
    '[]'::jsonb
  )
  INTO v_previous_profile_grants
  FROM public.project_client_profiles client_profile
  WHERE client_profile.project_id = target_project_id;

  DELETE FROM public.project_client_organizations
  WHERE project_id = target_project_id;

  INSERT INTO public.project_client_organizations (
    project_id, organization_id, added_by_profile_id
  )
  SELECT target_project_id, selected.organization_id, v_actor_profile_id
  FROM (
    SELECT DISTINCT organization_id
    FROM unnest(v_organization_ids) AS requested(organization_id)
  ) selected;

  IF target_mode = 'selected_clients' THEN
    INSERT INTO public.project_client_profiles (
      project_id, organization_id, profile_id, granted_by_profile_id
    )
    SELECT DISTINCT
      target_project_id,
      access_grant.organization_id,
      access_grant.profile_id,
      v_actor_profile_id
    FROM jsonb_to_recordset(v_profile_grants)
      AS access_grant(organization_id uuid, profile_id uuid);
  END IF;

  UPDATE public.projects
  SET client_access_mode = target_mode
  WHERE id = target_project_id;

  INSERT INTO public.app_activity_events (
    domain, event_type, entity_table, entity_id, actor_profile_id, summary, payload
  )
  VALUES (
    'projects',
    'project_client_access_changed',
    'projects',
    target_project_id,
    v_actor_profile_id,
    'Acesso de clientes atualizado.',
    jsonb_build_object(
      'project_id', target_project_id,
      'previous_mode', v_previous_mode,
      'mode', target_mode,
      'previous_organization_ids', to_jsonb(v_previous_organization_ids),
      'organization_ids', to_jsonb(v_organization_ids),
      'previous_profile_grants', v_previous_profile_grants,
      'profile_grants', CASE WHEN target_mode = 'selected_clients' THEN v_profile_grants ELSE '[]'::jsonb END
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_project_client_access(uuid, text, uuid[], jsonb)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.set_project_client_access(uuid, text, uuid[], jsonb)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.set_project_client_configuration(
  target_project_id uuid,
  target_configuration jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_profile_id uuid := NULLIF(target_configuration->>'client_contact_profile_id', '')::uuid;
  v_organization_ids uuid[] := ARRAY(
    SELECT value::uuid
    FROM jsonb_array_elements_text(
      COALESCE(target_configuration->'organization_ids', '[]'::jsonb)
    ) value
  );
BEGIN
  IF jsonb_typeof(COALESCE(target_configuration, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Client project configuration must be a JSON object.'
      USING ERRCODE = '22023';
  END IF;
  IF NOT (
    public.is_admin()
    OR (public.is_staff() AND public.is_project_owner_member(target_project_id))
  ) THEN
    RAISE EXCEPTION 'Only project owners or administrators can manage client project configuration.'
      USING ERRCODE = '42501';
  END IF;
  IF v_contact_profile_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.project_members member
    JOIN public.user_role_assignments role_assignment
      ON role_assignment.profile_id = member.profile_id
     AND role_assignment.role_code IN ('staff', 'admin')
    WHERE member.project_id = target_project_id
      AND member.profile_id = v_contact_profile_id
  ) THEN
    RAISE EXCEPTION 'The client contact must be an internal project team member.'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.projects
  SET client_summary = NULLIF(btrim(target_configuration->>'client_summary'), ''),
      client_scope = NULLIF(btrim(target_configuration->>'client_scope'), ''),
      client_contact_profile_id = v_contact_profile_id,
      client_next_steps = NULLIF(btrim(target_configuration->>'client_next_steps'), '')
  WHERE id = target_project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projeto não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.set_project_client_access(
    target_project_id,
    COALESCE(NULLIF(target_configuration->>'mode', ''), 'hidden'),
    v_organization_ids,
    COALESCE(target_configuration->'profile_grants', '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_project_client_configuration(uuid, jsonb)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.set_project_client_configuration(uuid, jsonb)
  TO authenticated;

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
    'client_next_steps', project.client_next_steps,
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
                'email', profile.email
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

CREATE OR REPLACE FUNCTION public.get_project_client_access_summary(target_project_id uuid)
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
    OR (
      public.is_staff()
      AND (
        public.is_project_team_member(target_project_id)
        OR public.is_project_org_admin(target_project_id)
      )
    )
  ) THEN
    RAISE EXCEPTION 'Only authorized internal project viewers can view the client access summary.'
      USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'mode', project.client_access_mode,
    'organization_names', COALESCE((
      SELECT jsonb_agg(organization.name ORDER BY organization.name)
      FROM public.project_client_organizations audience
      JOIN public.organizations organization
        ON organization.id = audience.organization_id
      WHERE audience.project_id = project.id
    ), '[]'::jsonb),
    'organization_count', (
      SELECT count(*)
      FROM public.project_client_organizations audience
      WHERE audience.project_id = project.id
    ),
    'selected_client_count', (
      SELECT count(*)
      FROM public.project_client_profiles client_profile
      WHERE client_profile.project_id = project.id
    ),
    'content_readiness', jsonb_build_object(
      'has_summary', NULLIF(btrim(project.client_summary), '') IS NOT NULL,
      'has_scope', NULLIF(btrim(project.client_scope), '') IS NOT NULL,
      'has_contact', project.client_contact_profile_id IS NOT NULL,
      'has_next_steps', NULLIF(btrim(project.client_next_steps), '') IS NOT NULL,
      'client_visible_milestone_count', (
        SELECT count(*)
        FROM public.project_milestones milestone
        WHERE milestone.project_id = project.id
          AND milestone.visibility = 'client'
      ),
      'shared_document_count', (
        SELECT count(*)
        FROM public.project_links link
        WHERE link.project_id = project.id
          AND link.visibility = 'client'
      )
    )
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

REVOKE ALL ON FUNCTION public.get_project_client_access_summary(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_project_client_access_summary(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.create_project_with_client_access(
  p_request_id uuid,
  p_project jsonb,
  p_organization_ids uuid[],
  p_members jsonb,
  p_client_access jsonb
)
RETURNS TABLE(project_id uuid, created boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_profile_id uuid := public.current_profile_id();
  v_actor_role text := public.current_global_role();
  v_payload jsonb := jsonb_build_object(
    'project', COALESCE(p_project, '{}'::jsonb),
    'organization_ids', to_jsonb(COALESCE(p_organization_ids, ARRAY[]::uuid[])),
    'members', COALESCE(p_members, '[]'::jsonb),
    'client_access', COALESCE(p_client_access, '{}'::jsonb)
  );
  v_existing public.project_creation_requests%ROWTYPE;
  v_project_id uuid;
  v_primary_organization_id uuid;
  v_owner_profile_id uuid;
  v_status text;
  v_mode text;
  v_access_organization_ids uuid[];
  v_profile_grants jsonb;
  v_organization_name text;
  v_organization_token text;
  v_project_token text;
  v_code_base text;
  v_code text;
  v_code_suffix integer := 1;
BEGIN
  IF p_request_id IS NULL OR v_actor_profile_id IS NULL OR v_actor_role NOT IN ('staff', 'admin') THEN
    RAISE EXCEPTION 'Only authenticated staff can create projects.' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(COALESCE(p_project, '{}'::jsonb)) <> 'object'
    OR jsonb_typeof(COALESCE(p_members, '[]'::jsonb)) <> 'array'
    OR jsonb_typeof(COALESCE(p_client_access, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Invalid project creation payload.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  SELECT request.* INTO v_existing
  FROM public.project_creation_requests request
  WHERE request.request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.actor_profile_id <> v_actor_profile_id OR v_existing.request_payload <> v_payload THEN
      RAISE EXCEPTION 'The idempotency key was already used with another request.' USING ERRCODE = '22023';
    END IF;
    RETURN QUERY SELECT v_existing.project_id, false;
    RETURN;
  END IF;

  v_primary_organization_id := NULLIF(p_project->>'primary_organization_id', '')::uuid;
  v_status := COALESCE(NULLIF(p_project->>'status', ''), 'planned');
  IF v_primary_organization_id IS NULL
    OR NULLIF(btrim(p_project->>'name'), '') IS NULL
    OR v_status NOT IN ('planned', 'active', 'paused', 'blocked', 'completed', 'canceled') THEN
    RAISE EXCEPTION 'Project name, primary organization, and status are invalid.' USING ERRCODE = '22023';
  END IF;
  IF NOT (v_primary_organization_id = ANY(COALESCE(p_organization_ids, ARRAY[]::uuid[]))) THEN
    RAISE EXCEPTION 'The primary organization must participate in the project.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(COALESCE(p_organization_ids, ARRAY[]::uuid[])) selected(organization_id)
    LEFT JOIN public.organizations organization ON organization.id = selected.organization_id
    WHERE selected.organization_id IS NULL OR organization.id IS NULL
  ) THEN
    RAISE EXCEPTION 'One or more participating organizations do not exist.' USING ERRCODE = '22023';
  END IF;
  SELECT organization.name
  INTO v_organization_name
  FROM public.organizations organization
  WHERE organization.id = v_primary_organization_id;
  IF NULLIF(p_project->>'start_date', '')::date > NULLIF(p_project->>'target_date', '')::date THEN
    RAISE EXCEPTION 'A data alvo não pode ser anterior à data de início.' USING ERRCODE = '22023';
  END IF;
  IF v_status = 'canceled' AND NULLIF(btrim(p_project->>'cancellation_reason'), '') IS NULL THEN
    RAISE EXCEPTION 'Indica o motivo do cancelamento.' USING ERRCODE = '22023';
  END IF;

  IF (SELECT count(*) FROM jsonb_to_recordset(p_members) AS member(profile_id uuid, role text) WHERE role = 'owner') <> 1 THEN
    RAISE EXCEPTION 'Exactly one internal project owner is required.' USING ERRCODE = '22023';
  END IF;
  IF (
    SELECT count(*) <> count(DISTINCT member.profile_id)
    FROM jsonb_to_recordset(p_members) AS member(profile_id uuid, role text)
  ) THEN
    RAISE EXCEPTION 'Each internal profile can appear only once in the project team.'
      USING ERRCODE = '22023';
  END IF;
  SELECT member.profile_id INTO v_owner_profile_id
  FROM jsonb_to_recordset(p_members) AS member(profile_id uuid, role text)
  WHERE member.role = 'owner';

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_members) AS member(profile_id uuid, role text)
    LEFT JOIN public.user_role_assignments role_assignment
      ON role_assignment.profile_id = member.profile_id
     AND role_assignment.role_code IN ('staff', 'admin')
    WHERE member.profile_id IS NULL
      OR member.role NOT IN ('owner', 'contributor', 'observer')
      OR role_assignment.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Project members must be internal staff.' USING ERRCODE = '22023';
  END IF;
  IF v_actor_role = 'staff' AND v_owner_profile_id <> v_actor_profile_id THEN
    RAISE EXCEPTION 'Staff creators must own the projects they create.' USING ERRCODE = '42501';
  END IF;

  IF NULLIF(p_project->>'client_contact_profile_id', '') IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_members) AS member(profile_id uuid, role text)
    JOIN public.user_role_assignments role_assignment
      ON role_assignment.profile_id = member.profile_id
     AND role_assignment.role_code IN ('staff', 'admin')
    WHERE member.profile_id = NULLIF(p_project->>'client_contact_profile_id', '')::uuid
  ) THEN
    RAISE EXCEPTION 'The client contact must be an internal project team member.' USING ERRCODE = '22023';
  END IF;

  v_code := NULLIF(upper(btrim(p_project->>'code')), '');
  IF v_code IS NULL THEN
    v_organization_token := trim(both '-' FROM regexp_replace(
      translate(
        upper(COALESCE(v_organization_name, 'ORG')),
        'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'AAAAAEEEEIIIIOOOOOUUUUC'
      ),
      '[^A-Z0-9]+',
      '-',
      'g'
    ));
    v_project_token := trim(both '-' FROM regexp_replace(
      translate(
        upper(COALESCE(p_project->>'name', 'PROJECT')),
        'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'AAAAAEEEEIIIIOOOOOUUUUC'
      ),
      '[^A-Z0-9]+',
      '-',
      'g'
    ));
    v_organization_token := COALESCE(NULLIF(array_to_string(
      (regexp_split_to_array(v_organization_token, '-'))[1:2], '-'
    ), ''), 'ORG');
    v_project_token := COALESCE(NULLIF(array_to_string(
      (regexp_split_to_array(v_project_token, '-'))[1:3], '-'
    ), ''), 'PROJECT');
    v_code_base := left(
      format('%s-%s-%s', v_organization_token, v_project_token, extract(year FROM current_date)::integer),
      72
    );

    -- Serialize only projects competing for the same generated reference.
    PERFORM pg_advisory_xact_lock(hashtextextended('project-code:' || v_code_base, 0));
    LOOP
      v_code := CASE
        WHEN v_code_suffix = 1 THEN v_code_base
        ELSE format('%s-%s', v_code_base, v_code_suffix)
      END;
      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM public.projects existing_project
        WHERE lower(existing_project.code) = lower(v_code)
      );
      v_code_suffix := v_code_suffix + 1;
    END LOOP;
  END IF;

  INSERT INTO public.projects (
    organization_id, name, code, status, health, owner_profile_id,
    start_date, target_date, cancellation_reason, summary,
    client_access_mode, client_summary, client_scope,
    client_contact_profile_id, client_next_steps
  )
  VALUES (
    v_primary_organization_id,
    btrim(p_project->>'name'),
    v_code,
    v_status,
    CASE WHEN v_status IN ('blocked', 'canceled') THEN 'off_track' ELSE 'on_track' END,
    v_owner_profile_id,
    NULLIF(p_project->>'start_date', '')::date,
    NULLIF(p_project->>'target_date', '')::date,
    CASE WHEN v_status = 'canceled' THEN NULLIF(btrim(p_project->>'cancellation_reason'), '') ELSE NULL END,
    NULLIF(btrim(p_project->>'summary'), ''),
    'hidden',
    NULLIF(btrim(p_project->>'client_summary'), ''),
    NULLIF(btrim(p_project->>'client_scope'), ''),
    NULLIF(p_project->>'client_contact_profile_id', '')::uuid,
    NULLIF(btrim(p_project->>'client_next_steps'), '')
  )
  RETURNING id INTO v_project_id;

  INSERT INTO public.project_organizations (
    project_id, organization_id, is_primary, added_by_profile_id
  )
  SELECT
    v_project_id,
    selected.organization_id,
    selected.organization_id = v_primary_organization_id,
    v_actor_profile_id
  FROM (
    SELECT DISTINCT organization_id
    FROM unnest(p_organization_ids) requested(organization_id)
  ) selected
  ON CONFLICT ON CONSTRAINT project_organizations_pkey
  DO UPDATE SET is_primary = EXCLUDED.is_primary;

  INSERT INTO public.project_members (project_id, profile_id, role)
  SELECT DISTINCT v_project_id, member.profile_id, member.role
  FROM jsonb_to_recordset(p_members) AS member(profile_id uuid, role text);

  v_mode := COALESCE(NULLIF(p_client_access->>'mode', ''), 'hidden');
  v_access_organization_ids := ARRAY(
    SELECT value::uuid
    FROM jsonb_array_elements_text(COALESCE(p_client_access->'organization_ids', '[]'::jsonb)) value
  );
  v_profile_grants := COALESCE(p_client_access->'profile_grants', '[]'::jsonb);
  PERFORM public.set_project_client_access(
    v_project_id,
    v_mode,
    v_access_organization_ids,
    v_profile_grants
  );

  INSERT INTO public.project_creation_requests (
    request_id, actor_profile_id, request_payload, project_id
  )
  VALUES (p_request_id, v_actor_profile_id, v_payload, v_project_id);

  RETURN QUERY SELECT v_project_id, true;
END;
$$;

REVOKE ALL ON FUNCTION public.create_project_with_client_access(uuid, jsonb, uuid[], jsonb, jsonb)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.create_project_with_client_access(uuid, jsonb, uuid[], jsonb, jsonb)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.list_current_client_projects()
RETURNS TABLE (
  project_id uuid,
  name text,
  reference text,
  status text,
  start_date date,
  target_date date,
  completed_at timestamptz,
  archived_at timestamptz,
  client_summary text,
  client_scope text,
  client_contact jsonb,
  client_next_steps text,
  organizations jsonb,
  progress_percent integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    project.id,
    project.name,
    project.code,
    project.status,
    project.start_date,
    project.target_date,
    project.completed_at,
    project.archived_at,
    project.client_summary,
    project.client_scope,
    CASE WHEN contact.id IS NULL THEN NULL ELSE jsonb_build_object(
      'profile_id', contact.id,
      'name', COALESCE(NULLIF(btrim(concat_ws(' ', contact.first_name, contact.last_name)), ''), contact.email),
      'email', contact.email
    ) END,
    project.client_next_steps,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', organization.id, 'name', organization.name) ORDER BY organization.name)
      FROM public.project_client_organizations audience
      JOIN public.organization_members org_member
        ON org_member.organization_id = audience.organization_id
       AND org_member.profile_id = public.current_profile_id()
      JOIN public.organizations organization ON organization.id = audience.organization_id
      WHERE audience.project_id = project.id
        AND (
          project.client_access_mode = 'all_org_clients'
          OR EXISTS (
            SELECT 1 FROM public.project_client_profiles grant_row
            WHERE grant_row.project_id = project.id
              AND grant_row.organization_id = audience.organization_id
              AND grant_row.profile_id = public.current_profile_id()
          )
        )
    ), '[]'::jsonb),
    CASE WHEN count(milestone.id) = 0 THEN 0
      ELSE round(100.0 * count(milestone.id) FILTER (WHERE milestone.status = 'achieved') / count(milestone.id))::integer
    END
  FROM public.projects project
  LEFT JOIN public.profiles contact ON contact.id = project.client_contact_profile_id
  LEFT JOIN public.project_milestones milestone
    ON milestone.project_id = project.id AND milestone.visibility = 'client'
  WHERE public.can_current_client_view_project(project.id)
  GROUP BY project.id, contact.id
  ORDER BY project.updated_at DESC;
$$;

REVOKE ALL ON FUNCTION public.list_current_client_projects()
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.list_current_client_projects()
  TO authenticated;

CREATE OR REPLACE FUNCTION public.get_current_client_project(target_project_id uuid)
RETURNS TABLE (
  project_id uuid,
  name text,
  reference text,
  status text,
  start_date date,
  target_date date,
  completed_at timestamptz,
  archived_at timestamptz,
  client_summary text,
  client_scope text,
  client_contact jsonb,
  client_next_steps text,
  organizations jsonb,
  progress_percent integer,
  metas jsonb,
  documents jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    list_row.project_id,
    list_row.name,
    list_row.reference,
    list_row.status,
    list_row.start_date,
    list_row.target_date,
    list_row.completed_at,
    list_row.archived_at,
    list_row.client_summary,
    list_row.client_scope,
    list_row.client_contact,
    list_row.client_next_steps,
    list_row.organizations,
    list_row.progress_percent,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', milestone.id,
        'title', milestone.title,
        'status', milestone.status,
        'target_date', milestone.target_date,
        'completed_at', milestone.completed_at,
        'position', milestone.position
      ) ORDER BY milestone.position, milestone.target_date, milestone.id)
      FROM public.project_milestones milestone
      WHERE milestone.project_id = target_project_id
        AND milestone.visibility = 'client'
    ), '[]'::jsonb),
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', link.id,
        'label', link.label,
        'url', link.url,
        'kind', link.kind,
        'created_at', link.created_at
      ) ORDER BY link.created_at DESC, link.id)
      FROM public.project_links link
      WHERE link.project_id = target_project_id
        AND link.visibility = 'client'
    ), '[]'::jsonb)
  FROM public.list_current_client_projects() list_row
  WHERE list_row.project_id = target_project_id;
$$;

REVOKE ALL ON FUNCTION public.get_current_client_project(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_current_client_project(uuid)
  TO authenticated;
