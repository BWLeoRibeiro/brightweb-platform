-- Install fail-closed project boundaries before any destructive identity
-- cleanup. This migration is safe to deploy while older project rows still
-- contain external observer memberships.

CREATE OR REPLACE FUNCTION public.enforce_project_client_content_manager()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.client_contact_profile_id IS DISTINCT FROM OLD.client_contact_profile_id
    AND NEW.client_contact_profile_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.project_members member
      JOIN public.user_role_assignments role_assignment
        ON role_assignment.profile_id = member.profile_id
       AND role_assignment.role_code IN ('staff', 'admin')
      WHERE member.project_id = NEW.id
        AND member.profile_id = NEW.client_contact_profile_id
    ) THEN
    RAISE EXCEPTION 'The client contact must be an internal project team member.'
      USING ERRCODE = '23514';
  END IF;

  IF (
    NEW.client_access_mode IS DISTINCT FROM OLD.client_access_mode
    OR NEW.client_summary IS DISTINCT FROM OLD.client_summary
    OR NEW.client_scope IS DISTINCT FROM OLD.client_scope
    OR NEW.client_contact_profile_id IS DISTINCT FROM OLD.client_contact_profile_id
    OR NEW.client_next_steps IS DISTINCT FROM OLD.client_next_steps
  ) AND NOT (
    public.is_admin()
    OR (public.is_staff() AND public.is_project_owner_member(OLD.id))
  ) THEN
    RAISE EXCEPTION 'Only project owners or administrators can publish client content.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_project_client_content_manager ON public.projects;
CREATE TRIGGER trg_enforce_project_client_content_manager
BEFORE UPDATE OF client_access_mode, client_summary, client_scope,
  client_contact_profile_id, client_next_steps ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.enforce_project_client_content_manager();

CREATE OR REPLACE FUNCTION public.enforce_client_visible_project_item_manager()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id uuid := COALESCE(NEW.project_id, OLD.project_id);
  v_previous_visibility text := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.visibility END;
  v_next_visibility text := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.visibility END;
BEGIN
  IF (v_previous_visibility = 'client' OR v_next_visibility = 'client')
    AND NOT (
      public.is_admin()
      OR (public.is_staff() AND public.is_project_owner_member(v_project_id))
    ) THEN
    RAISE EXCEPTION 'Only project owners or administrators can publish client-visible items.'
      USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_client_milestone_manager ON public.project_milestones;
CREATE TRIGGER trg_enforce_client_milestone_manager
BEFORE INSERT OR UPDATE OR DELETE ON public.project_milestones
FOR EACH ROW
EXECUTE FUNCTION public.enforce_client_visible_project_item_manager();

DROP TRIGGER IF EXISTS trg_enforce_client_link_manager ON public.project_links;
CREATE TRIGGER trg_enforce_client_link_manager
BEFORE INSERT OR UPDATE OR DELETE ON public.project_links
FOR EACH ROW
EXECUTE FUNCTION public.enforce_client_visible_project_item_manager();

-- Primary contacts remain organization admins only. Project membership is
-- always an explicit internal staff decision.
CREATE OR REPLACE FUNCTION public.sync_org_primary_contact_admin_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.primary_contact_id IS DISTINCT FROM NEW.primary_contact_id THEN
    IF OLD.primary_contact_id IS NOT NULL THEN
      DELETE FROM public.organization_members
      WHERE organization_id = NEW.id
        AND profile_id = OLD.primary_contact_id
        AND role = 'admin';
    END IF;
  END IF;

  IF NEW.primary_contact_id IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, profile_id, role)
    VALUES (NEW.id, NEW.primary_contact_id, 'admin')
    ON CONFLICT (organization_id, profile_id)
    DO UPDATE SET role = 'admin';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.create_project_with_client_access(uuid, jsonb, uuid[], jsonb, jsonb)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.set_project_client_configuration(uuid, jsonb)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.get_project_access_configuration(uuid)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.get_project_client_access_summary(uuid)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.list_current_client_projects()
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.get_current_client_project(uuid)
  FROM PUBLIC, anon, service_role;

-- RLS can decide which project rows a contributor may edit, but it cannot
-- safely express column-level identity rules. Protect ownership and the
-- primary organization before enabling the broader staff update policy.
CREATE OR REPLACE FUNCTION public.protect_project_identity_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    NEW.owner_profile_id IS DISTINCT FROM OLD.owner_profile_id
    OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
  ) AND NOT (
    public.is_admin()
    OR (
      public.is_staff()
      AND (
        OLD.owner_profile_id = public.current_profile_id()
        OR EXISTS (
          SELECT 1
          FROM public.project_members member
          WHERE member.project_id = OLD.id
            AND member.profile_id = public.current_profile_id()
            AND member.role = 'owner'
        )
      )
    )
  ) THEN
    RAISE EXCEPTION 'Only project owners or administrators can change project ownership or the primary organization.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.owner_profile_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.user_role_assignments role_assignment
    WHERE role_assignment.profile_id = NEW.owner_profile_id
      AND role_assignment.role_code IN ('staff', 'admin')
  ) THEN
    RAISE EXCEPTION 'Project owners must be internal staff.' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_project_identity_fields ON public.projects;
CREATE TRIGGER trg_protect_project_identity_fields
BEFORE UPDATE OF owner_profile_id, organization_id ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.protect_project_identity_fields();

-- Keep owner_profile_id and the internal owner membership atomic before the
-- later legacy cleanup runs. This blocks direct PostgREST owner promotion while
-- still allowing sync_project_members_exact() to update both in one transaction.
CREATE OR REPLACE FUNCTION public.validate_project_owner_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id uuid;
  v_owner_profile_id uuid;
  v_owner_count integer;
  v_matching_owner_count integer;
BEGIN
  v_project_id := CASE
    WHEN TG_TABLE_NAME = 'projects' THEN COALESCE(NEW.id, OLD.id)
    ELSE COALESCE(NEW.project_id, OLD.project_id)
  END;

  SELECT project.owner_profile_id
  INTO v_owner_profile_id
  FROM public.projects project
  WHERE project.id = v_project_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT
    count(*) FILTER (WHERE member.role = 'owner'),
    count(*) FILTER (
      WHERE member.role = 'owner'
        AND member.profile_id = v_owner_profile_id
    )
  INTO v_owner_count, v_matching_owner_count
  FROM public.project_members member
  WHERE member.project_id = v_project_id;

  IF (v_owner_profile_id IS NULL AND v_owner_count <> 0)
    OR (v_owner_profile_id IS NOT NULL AND (v_owner_count <> 1 OR v_matching_owner_count <> 1)) THEN
    RAISE EXCEPTION 'Project owner and owner membership must match exactly.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_project_owner_from_project ON public.projects;
CREATE CONSTRAINT TRIGGER trg_validate_project_owner_from_project
AFTER INSERT OR UPDATE OF owner_profile_id ON public.projects
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.validate_project_owner_consistency();

DROP TRIGGER IF EXISTS trg_validate_project_owner_from_member ON public.project_members;
CREATE CONSTRAINT TRIGGER trg_validate_project_owner_from_member
AFTER INSERT OR UPDATE OR DELETE ON public.project_members
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.validate_project_owner_consistency();

-- Explicit selected-client grants must not silently reactivate if a profile is
-- later changed back to the client role. Leaving the client role revokes the
-- approval and a project owner must select the profile again.
CREATE OR REPLACE FUNCTION public.clear_stale_project_client_profile_grants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role_code = 'client'
    AND (TG_OP = 'DELETE' OR NEW.role_code <> 'client') THEN
    DELETE FROM public.project_client_profiles grant_row
    WHERE grant_row.profile_id = OLD.profile_id;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_stale_project_client_profile_grants
  ON public.user_role_assignments;
CREATE TRIGGER trg_clear_stale_project_client_profile_grants
AFTER UPDATE OF role_code OR DELETE ON public.user_role_assignments
FOR EACH ROW
EXECUTE FUNCTION public.clear_stale_project_client_profile_grants();

-- Project membership is internal. Client access is represented only by the
-- explicit organization/profile audience tables above.
DROP POLICY IF EXISTS "Project team view projects" ON public.projects;
DROP POLICY IF EXISTS "Project staff view projects" ON public.projects;
CREATE POLICY "Project staff view projects"
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR (
      public.is_staff()
      AND (public.is_project_team_member(id) OR public.is_project_org_admin(id))
    )
  );

DROP POLICY IF EXISTS "Project team create projects" ON public.projects;
CREATE POLICY "Project staff create projects"
  ON public.projects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      public.is_staff()
      AND (
        owner_profile_id = public.current_profile_id()
        OR public.can_create_projects_for_org(organization_id)
      )
    )
  );

DROP POLICY IF EXISTS "Project team update projects" ON public.projects;
CREATE POLICY "Project staff update projects"
  ON public.projects
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR (public.is_staff() AND public.is_project_content_editor(id))
  )
  WITH CHECK (
    public.is_admin()
    OR (public.is_staff() AND public.is_project_content_editor(id))
  );

DROP POLICY IF EXISTS "Project owners delete projects" ON public.projects;
CREATE POLICY "Project staff delete projects"
  ON public.projects
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR (public.is_staff() AND public.is_project_owner_member(id))
  );

DROP POLICY IF EXISTS "Project team view project members" ON public.project_members;
DROP POLICY IF EXISTS "Project staff view project members" ON public.project_members;
CREATE POLICY "Project staff view project members"
  ON public.project_members
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR (public.is_staff() AND public.is_project_team_member(project_id))
  );

DROP POLICY IF EXISTS "Project owners insert project members" ON public.project_members;
CREATE POLICY "Project staff insert project members"
  ON public.project_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (public.is_staff() AND public.is_project_owner_member(project_id))
  );

DROP POLICY IF EXISTS "Project owners update project members" ON public.project_members;
CREATE POLICY "Project staff update project members"
  ON public.project_members
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR (public.is_staff() AND public.is_project_owner_member(project_id))
  )
  WITH CHECK (
    public.is_admin()
    OR (public.is_staff() AND public.is_project_owner_member(project_id))
  );

DROP POLICY IF EXISTS "Project owners delete project members" ON public.project_members;
CREATE POLICY "Project staff delete project members"
  ON public.project_members
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR (public.is_staff() AND public.is_project_owner_member(project_id))
  );

DROP POLICY IF EXISTS "Project team view project milestones" ON public.project_milestones;
DROP POLICY IF EXISTS "Authorized users view project milestones" ON public.project_milestones;
CREATE POLICY "Authorized users view project milestones"
  ON public.project_milestones
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR (public.is_staff() AND public.is_project_team_member(project_id))
    OR (
      visibility = 'client'
      AND public.can_current_client_view_project(project_id)
    )
  );

DROP POLICY IF EXISTS "Project content editors insert project milestones" ON public.project_milestones;
CREATE POLICY "Project staff insert project milestones"
  ON public.project_milestones
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (public.is_staff() AND public.is_project_content_editor(project_id))
  );

DROP POLICY IF EXISTS "Project content editors update project milestones" ON public.project_milestones;
CREATE POLICY "Project staff update project milestones"
  ON public.project_milestones
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR (public.is_staff() AND public.is_project_content_editor(project_id))
  )
  WITH CHECK (
    public.is_admin()
    OR (public.is_staff() AND public.is_project_content_editor(project_id))
  );

DROP POLICY IF EXISTS "Project content editors delete project milestones" ON public.project_milestones;
CREATE POLICY "Project staff delete project milestones"
  ON public.project_milestones
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR (public.is_staff() AND public.is_project_content_editor(project_id))
  );

DROP POLICY IF EXISTS "Project team view project tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Project staff view project tasks" ON public.project_tasks;
CREATE POLICY "Project staff view project tasks"
  ON public.project_tasks
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR (public.is_staff() AND public.is_project_team_member(project_id))
  );

DROP POLICY IF EXISTS "Project content editors insert project tasks" ON public.project_tasks;
CREATE POLICY "Project staff insert project tasks"
  ON public.project_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (public.is_staff() AND public.is_project_content_editor(project_id))
  );

DROP POLICY IF EXISTS "Project content editors update project tasks" ON public.project_tasks;
CREATE POLICY "Project staff update project tasks"
  ON public.project_tasks
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR (public.is_staff() AND public.is_project_content_editor(project_id))
  )
  WITH CHECK (
    public.is_admin()
    OR (public.is_staff() AND public.is_project_content_editor(project_id))
  );

DROP POLICY IF EXISTS "Project content editors delete project tasks" ON public.project_tasks;
CREATE POLICY "Project staff delete project tasks"
  ON public.project_tasks
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR (public.is_staff() AND public.is_project_content_editor(project_id))
  );

DROP POLICY IF EXISTS "Project team view project links" ON public.project_links;
DROP POLICY IF EXISTS "Authorized users view project links" ON public.project_links;
CREATE POLICY "Authorized users view project links"
  ON public.project_links
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR (public.is_staff() AND public.is_project_team_member(project_id))
    OR (
      visibility = 'client'
      AND public.can_current_client_view_project(project_id)
    )
  );

DROP POLICY IF EXISTS "Project team create project links" ON public.project_links;
CREATE POLICY "Project staff create project links"
  ON public.project_links
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (public.is_staff() AND public.is_project_team_member(project_id))
  );

DROP POLICY IF EXISTS "Project content editors update project links" ON public.project_links;
CREATE POLICY "Project staff update project links"
  ON public.project_links
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR (public.is_staff() AND public.is_project_content_editor(project_id))
  )
  WITH CHECK (
    public.is_admin()
    OR (public.is_staff() AND public.is_project_content_editor(project_id))
  );

DROP POLICY IF EXISTS "Project content editors delete project links" ON public.project_links;
CREATE POLICY "Project staff delete project links"
  ON public.project_links
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR (public.is_staff() AND public.is_project_content_editor(project_id))
  );

DROP POLICY IF EXISTS "Project team view project status log" ON public.project_status_log;
DROP POLICY IF EXISTS "Project staff view project status log" ON public.project_status_log;
CREATE POLICY "Project staff view project status log"
  ON public.project_status_log
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR (public.is_staff() AND public.is_project_team_member(project_id))
  );


-- Notification and realtime activity audiences remain internal even when a
-- project is client-visible. Client-facing updates need a separate safe feed.
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
  IF v_role <> 'staff' THEN
    RETURN false;
  END IF;

  BEGIN
    v_project_id := NULLIF(COALESCE(p_payload, '{}'::jsonb)->>'project_id', '')::uuid;
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
      AND (
        project.owner_profile_id = p_profile_id
        OR EXISTS (
          SELECT 1
          FROM public.project_members member
          WHERE member.project_id = project.id
            AND member.profile_id = p_profile_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.organization_members member
          WHERE member.organization_id = project.organization_id
            AND member.profile_id = p_profile_id
            AND member.role = 'admin'
        )
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.can_profile_view_app_activity_event(uuid, text, text, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_profile_view_app_activity_event(uuid, text, text, uuid, jsonb)
  TO service_role;

CREATE OR REPLACE FUNCTION public.can_view_app_activity_event(
  p_domain text,
  p_entity_table text,
  p_entity_id uuid,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_profile_view_app_activity_event(
    public.current_profile_id(),
    p_domain,
    p_entity_table,
    p_entity_id,
    p_payload
  )
$$;

REVOKE ALL ON FUNCTION public.can_view_app_activity_event(text, text, uuid, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_app_activity_event(text, text, uuid, jsonb)
  TO authenticated;

DROP POLICY IF EXISTS "Project members can view project activity events"
  ON public.app_activity_events;
DROP POLICY IF EXISTS "Project staff can view project activity events"
  ON public.app_activity_events;
DROP POLICY IF EXISTS "Staff can view app activity events"
  ON public.app_activity_events;
CREATE POLICY "Staff can view app activity events"
  ON public.app_activity_events
  FOR SELECT
  TO authenticated
  USING (
    public.is_staff()
    AND public.can_view_app_activity_event(domain, entity_table, entity_id, payload)
  );

DROP TRIGGER IF EXISTS capture_removed_project_member_realtime_audience
  ON public.app_activity_events;
DROP FUNCTION IF EXISTS public.capture_removed_project_member_realtime_audience();
