-- Projects are created by platform administrators. Internal ownership may be
-- assigned later; contributors may only advance their own assigned tasks.

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
  IF p_request_id IS NULL OR v_actor_profile_id IS NULL OR v_actor_role <> 'admin' THEN
    RAISE EXCEPTION 'Only administrators can create projects.' USING ERRCODE = '42501';
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
  SELECT organization.name INTO v_organization_name
  FROM public.organizations organization
  WHERE organization.id = v_primary_organization_id;
  IF NULLIF(p_project->>'start_date', '')::date > NULLIF(p_project->>'target_date', '')::date THEN
    RAISE EXCEPTION 'A data alvo não pode ser anterior à data de início.' USING ERRCODE = '22023';
  END IF;
  IF v_status = 'canceled' AND NULLIF(btrim(p_project->>'cancellation_reason'), '') IS NULL THEN
    RAISE EXCEPTION 'Indica o motivo do cancelamento.' USING ERRCODE = '22023';
  END IF;

  IF (SELECT count(*) FROM jsonb_to_recordset(p_members) AS member(profile_id uuid, role text) WHERE role = 'owner') > 1 THEN
    RAISE EXCEPTION 'A project can have at most one internal project manager.' USING ERRCODE = '22023';
  END IF;
  IF (
    SELECT count(*) <> count(DISTINCT member.profile_id)
    FROM jsonb_to_recordset(p_members) AS member(profile_id uuid, role text)
  ) THEN
    RAISE EXCEPTION 'Each internal profile can appear only once in the project team.' USING ERRCODE = '22023';
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
  IF NULLIF(p_project->>'client_contact_profile_id', '') IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_members) AS member(profile_id uuid, role text)
    WHERE member.profile_id = NULLIF(p_project->>'client_contact_profile_id', '')::uuid
      AND member.role IN ('owner', 'contributor')
  ) THEN
    RAISE EXCEPTION 'The client contact must be an active internal project member.' USING ERRCODE = '22023';
  END IF;

  v_code := NULLIF(upper(btrim(p_project->>'code')), '');
  IF v_code IS NULL THEN
    v_organization_token := trim(both '-' FROM regexp_replace(
      translate(upper(COALESCE(v_organization_name, 'ORG')), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC'),
      '[^A-Z0-9]+', '-', 'g'
    ));
    v_project_token := trim(both '-' FROM regexp_replace(
      translate(upper(COALESCE(p_project->>'name', 'PROJECT')), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC'),
      '[^A-Z0-9]+', '-', 'g'
    ));
    v_organization_token := COALESCE(NULLIF(array_to_string((regexp_split_to_array(v_organization_token, '-'))[1:2], '-'), ''), 'ORG');
    v_project_token := COALESCE(NULLIF(array_to_string((regexp_split_to_array(v_project_token, '-'))[1:3], '-'), ''), 'PROJECT');
    v_code_base := left(format('%s-%s-%s', v_organization_token, v_project_token, extract(year FROM current_date)::integer), 72);
    PERFORM pg_advisory_xact_lock(hashtextextended('project-code:' || v_code_base, 0));
    LOOP
      v_code := CASE WHEN v_code_suffix = 1 THEN v_code_base ELSE format('%s-%s', v_code_base, v_code_suffix) END;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.projects existing_project WHERE lower(existing_project.code) = lower(v_code));
      v_code_suffix := v_code_suffix + 1;
    END LOOP;
  END IF;

  INSERT INTO public.projects (
    organization_id, name, code, status, health, owner_profile_id,
    start_date, target_date, cancellation_reason, summary,
    client_access_mode, client_summary, client_scope,
    client_contact_profile_id
  ) VALUES (
    v_primary_organization_id, btrim(p_project->>'name'), v_code, v_status,
    CASE WHEN v_status IN ('blocked', 'canceled') THEN 'off_track' ELSE 'on_track' END,
    v_owner_profile_id,
    NULLIF(p_project->>'start_date', '')::date,
    NULLIF(p_project->>'target_date', '')::date,
    CASE WHEN v_status = 'canceled' THEN NULLIF(btrim(p_project->>'cancellation_reason'), '') ELSE NULL END,
    NULLIF(btrim(p_project->>'summary'), ''), 'hidden',
    NULLIF(btrim(p_project->>'client_summary'), ''),
    NULLIF(btrim(p_project->>'client_scope'), ''),
    NULLIF(p_project->>'client_contact_profile_id', '')::uuid
  ) RETURNING id INTO v_project_id;

  INSERT INTO public.project_organizations (project_id, organization_id, is_primary, added_by_profile_id)
  SELECT v_project_id, selected.organization_id,
    selected.organization_id = v_primary_organization_id, v_actor_profile_id
  FROM (SELECT DISTINCT organization_id FROM unnest(p_organization_ids) requested(organization_id)) selected
  ON CONFLICT ON CONSTRAINT project_organizations_pkey
  DO UPDATE SET is_primary = EXCLUDED.is_primary;

  INSERT INTO public.project_members (project_id, profile_id, role)
  SELECT DISTINCT v_project_id, member.profile_id, member.role
  FROM jsonb_to_recordset(p_members) AS member(profile_id uuid, role text);

  v_mode := COALESCE(NULLIF(p_client_access->>'mode', ''), 'hidden');
  v_access_organization_ids := ARRAY(
    SELECT value::uuid FROM jsonb_array_elements_text(COALESCE(p_client_access->'organization_ids', '[]'::jsonb)) value
  );
  v_profile_grants := COALESCE(p_client_access->'profile_grants', '[]'::jsonb);
  PERFORM public.set_project_client_access(v_project_id, v_mode, v_access_organization_ids, v_profile_grants);

  INSERT INTO public.project_creation_requests (request_id, actor_profile_id, request_payload, project_id)
  VALUES (p_request_id, v_actor_profile_id, v_payload, v_project_id);
  RETURN QUERY SELECT v_project_id, true;
END;
$$;

REVOKE ALL ON FUNCTION public.create_project_with_client_access(uuid, jsonb, uuid[], jsonb, jsonb)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.create_project_with_client_access(uuid, jsonb, uuid[], jsonb, jsonb)
  TO authenticated;

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
  FROM public.projects project WHERE project.id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Projeto não encontrado.' USING ERRCODE = 'P0002'; END IF;

  IF NOT (
    public.is_admin()
    OR (public.is_staff() AND v_current_owner_profile_id = v_actor_profile_id)
  ) THEN
    RAISE EXCEPTION 'Only project managers or administrators can manage the internal project team.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(v_members) AS member(profile_id uuid, role text)
    WHERE member.profile_id IS NULL OR member.role NOT IN ('owner', 'contributor', 'observer')
  ) THEN
    RAISE EXCEPTION 'Every project member requires a valid profile and role.' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) <> count(DISTINCT member.profile_id) FROM jsonb_to_recordset(v_members) AS member(profile_id uuid, role text)) THEN
    RAISE EXCEPTION 'Each internal profile can appear only once in the project team.' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM jsonb_to_recordset(v_members) AS member(profile_id uuid, role text) WHERE member.role = 'owner') > 1
    OR (p_owner_profile_id IS NULL AND EXISTS (SELECT 1 FROM jsonb_to_recordset(v_members) AS member(profile_id uuid, role text) WHERE member.role = 'owner'))
    OR (p_owner_profile_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM jsonb_to_recordset(v_members) AS member(profile_id uuid, role text)
      WHERE member.profile_id = p_owner_profile_id AND member.role = 'owner'
    )) THEN
    RAISE EXCEPTION 'The optional project manager must match the owner membership exactly.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(v_members) AS member(profile_id uuid, role text)
    LEFT JOIN public.user_role_assignments role_assignment
      ON role_assignment.profile_id = member.profile_id AND role_assignment.role_code IN ('staff', 'admin')
    WHERE role_assignment.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Project members must be internal staff.' USING ERRCODE = '22023';
  END IF;
  IF v_client_contact_profile_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM jsonb_to_recordset(v_members) AS member(profile_id uuid, role text)
    WHERE member.profile_id = v_client_contact_profile_id AND member.role IN ('owner', 'contributor')
  ) THEN
    RAISE EXCEPTION 'The responsible client contact must remain an active internal project member.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.project_tasks task
    WHERE task.project_id = p_project_id
      AND task.status <> 'done'
      AND task.assignee_profile_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_to_recordset(v_members) AS member(profile_id uuid, role text)
        WHERE member.profile_id = task.assignee_profile_id AND member.role IN ('owner', 'contributor')
      )
  ) THEN
    RAISE EXCEPTION 'Reassign or unassign open tasks before removing this person from the active project team.' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.project_members(project_id, profile_id, role)
  SELECT p_project_id, member.profile_id, member.role
  FROM jsonb_to_recordset(v_members) AS member(profile_id uuid, role text)
  ON CONFLICT (project_id, profile_id) DO UPDATE SET role = EXCLUDED.role;
  DELETE FROM public.project_members existing
  WHERE existing.project_id = p_project_id
    AND NOT EXISTS (SELECT 1 FROM jsonb_to_recordset(v_members) AS member(profile_id uuid, role text) WHERE member.profile_id = existing.profile_id);
  UPDATE public.projects SET owner_profile_id = p_owner_profile_id WHERE id = p_project_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_project_members_exact(uuid, jsonb, uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.sync_project_members_exact(uuid, jsonb, uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_project_task_assignee_and_contributor_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_profile_id uuid := public.current_profile_id();
BEGIN
  IF NEW.assignee_profile_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.project_members member
    WHERE member.project_id = NEW.project_id
      AND member.profile_id = NEW.assignee_profile_id
      AND member.role IN ('owner', 'contributor')
  ) THEN
    RAISE EXCEPTION 'Tasks can only be assigned to project managers or collaborators.' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE'
    AND public.is_staff()
    AND NOT public.is_admin()
    AND NOT public.is_project_owner_member(OLD.project_id) THEN
    IF OLD.assignee_profile_id IS DISTINCT FROM v_actor_profile_id
      OR NEW.project_id IS DISTINCT FROM OLD.project_id
      OR NEW.milestone_id IS DISTINCT FROM OLD.milestone_id
      OR NEW.title IS DISTINCT FROM OLD.title
      OR NEW.description IS DISTINCT FROM OLD.description
      OR NEW.priority IS DISTINCT FROM OLD.priority
      OR NEW.assignee_profile_id IS DISTINCT FROM OLD.assignee_profile_id
      OR NEW.reporter_profile_id IS DISTINCT FROM OLD.reporter_profile_id
      OR NEW.start_date IS DISTINCT FROM OLD.start_date
      OR NEW.due_date IS DISTINCT FROM OLD.due_date THEN
      RAISE EXCEPTION 'Collaborators can only update the state of their assigned tasks.' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_project_task_assignee_and_contributor_update ON public.project_tasks;
CREATE TRIGGER trg_enforce_project_task_assignee_and_contributor_update
BEFORE INSERT OR UPDATE ON public.project_tasks
FOR EACH ROW EXECUTE FUNCTION public.enforce_project_task_assignee_and_contributor_update();

DROP POLICY IF EXISTS "Project staff create projects" ON public.projects;
CREATE POLICY "Administrators create projects" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Project staff update projects" ON public.projects;
CREATE POLICY "Project managers update projects" ON public.projects FOR UPDATE TO authenticated
  USING (public.is_admin() OR (public.is_staff() AND public.is_project_owner_member(id)))
  WITH CHECK (public.is_admin() OR (public.is_staff() AND public.is_project_owner_member(id)));

DROP POLICY IF EXISTS "Project staff delete projects" ON public.projects;
CREATE POLICY "Administrators delete projects" ON public.projects FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Project staff insert project milestones" ON public.project_milestones;
CREATE POLICY "Project managers insert project milestones" ON public.project_milestones FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR (public.is_staff() AND public.is_project_owner_member(project_id)));
DROP POLICY IF EXISTS "Project staff update project milestones" ON public.project_milestones;
CREATE POLICY "Project managers update project milestones" ON public.project_milestones FOR UPDATE TO authenticated
  USING (public.is_admin() OR (public.is_staff() AND public.is_project_owner_member(project_id)))
  WITH CHECK (public.is_admin() OR (public.is_staff() AND public.is_project_owner_member(project_id)));
DROP POLICY IF EXISTS "Project staff delete project milestones" ON public.project_milestones;
CREATE POLICY "Project managers delete project milestones" ON public.project_milestones FOR DELETE TO authenticated
  USING (public.is_admin() OR (public.is_staff() AND public.is_project_owner_member(project_id)));

DROP POLICY IF EXISTS "Project staff insert project tasks" ON public.project_tasks;
CREATE POLICY "Project managers insert project tasks" ON public.project_tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR (public.is_staff() AND public.is_project_owner_member(project_id)));
DROP POLICY IF EXISTS "Project staff update project tasks" ON public.project_tasks;
CREATE POLICY "Project team update permitted tasks" ON public.project_tasks FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (public.is_staff() AND public.is_project_owner_member(project_id))
    OR (public.is_staff() AND assignee_profile_id = public.current_profile_id() AND public.is_project_content_editor(project_id))
  )
  WITH CHECK (
    public.is_admin()
    OR (public.is_staff() AND public.is_project_owner_member(project_id))
    OR (public.is_staff() AND assignee_profile_id = public.current_profile_id() AND public.is_project_content_editor(project_id))
  );
DROP POLICY IF EXISTS "Project staff delete project tasks" ON public.project_tasks;
CREATE POLICY "Project managers delete project tasks" ON public.project_tasks FOR DELETE TO authenticated
  USING (public.is_admin() OR (public.is_staff() AND public.is_project_owner_member(project_id)));

DROP POLICY IF EXISTS "Project staff create project links" ON public.project_links;
CREATE POLICY "Project managers create project links" ON public.project_links FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR (public.is_staff() AND public.is_project_owner_member(project_id)));
DROP POLICY IF EXISTS "Project staff update project links" ON public.project_links;
CREATE POLICY "Project managers update project links" ON public.project_links FOR UPDATE TO authenticated
  USING (public.is_admin() OR (public.is_staff() AND public.is_project_owner_member(project_id)))
  WITH CHECK (public.is_admin() OR (public.is_staff() AND public.is_project_owner_member(project_id)));
DROP POLICY IF EXISTS "Project staff delete project links" ON public.project_links;
CREATE POLICY "Project managers delete project links" ON public.project_links FOR DELETE TO authenticated
  USING (public.is_admin() OR (public.is_staff() AND public.is_project_owner_member(project_id)));
