-- Observer permissions update:
-- - observers can read project data and create links
-- - observers cannot edit tasks, milestones, members, or update/delete links

CREATE OR REPLACE FUNCTION public.is_project_content_editor(target_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = target_project_id
      AND (
        p.owner_profile_id = public.current_profile_id()
        OR EXISTS (
          SELECT 1
          FROM public.project_members pm
          WHERE pm.project_id = p.id
            AND pm.profile_id = public.current_profile_id()
            AND pm.role IN ('owner', 'contributor')
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.is_project_owner_member(target_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = target_project_id
      AND (
        p.owner_profile_id = public.current_profile_id()
        OR EXISTS (
          SELECT 1
          FROM public.project_members pm
          WHERE pm.project_id = p.id
            AND pm.profile_id = public.current_profile_id()
            AND pm.role = 'owner'
        )
      )
  )
$$;

-- Members: only admins and owners can manage.
DROP POLICY IF EXISTS "Project team manage project members" ON public.project_members;
DROP POLICY IF EXISTS "Project owners manage project members" ON public.project_members;
CREATE POLICY "Project owners manage project members"
  ON public.project_members
  FOR ALL
  TO authenticated
  USING (public.is_admin() OR public.is_project_owner_member(project_id))
  WITH CHECK (public.is_admin() OR public.is_project_owner_member(project_id));

-- Milestones: only admins and content editors (owner/contributor).
DROP POLICY IF EXISTS "Project team manage project milestones" ON public.project_milestones;
DROP POLICY IF EXISTS "Project content editors manage project milestones" ON public.project_milestones;
CREATE POLICY "Project content editors manage project milestones"
  ON public.project_milestones
  FOR ALL
  TO authenticated
  USING (public.is_admin() OR public.is_project_content_editor(project_id))
  WITH CHECK (public.is_admin() OR public.is_project_content_editor(project_id));

-- Tasks: only admins and content editors (owner/contributor).
DROP POLICY IF EXISTS "Project team manage project tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Project content editors manage project tasks" ON public.project_tasks;
CREATE POLICY "Project content editors manage project tasks"
  ON public.project_tasks
  FOR ALL
  TO authenticated
  USING (public.is_admin() OR public.is_project_content_editor(project_id))
  WITH CHECK (public.is_admin() OR public.is_project_content_editor(project_id));

-- Links:
-- 1) observers may create links
-- 2) only admins and content editors may update/delete links
DROP POLICY IF EXISTS "Project team manage project links" ON public.project_links;
DROP POLICY IF EXISTS "Project team view project links" ON public.project_links;
DROP POLICY IF EXISTS "Project team create project links" ON public.project_links;
DROP POLICY IF EXISTS "Project content editors update project links" ON public.project_links;
DROP POLICY IF EXISTS "Project content editors delete project links" ON public.project_links;

CREATE POLICY "Project team view project links"
  ON public.project_links
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.is_project_team_member(project_id));

CREATE POLICY "Project team create project links"
  ON public.project_links
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() OR public.is_project_team_member(project_id));

CREATE POLICY "Project content editors update project links"
  ON public.project_links
  FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR public.is_project_content_editor(project_id))
  WITH CHECK (public.is_admin() OR public.is_project_content_editor(project_id));

CREATE POLICY "Project content editors delete project links"
  ON public.project_links
  FOR DELETE
  TO authenticated
  USING (public.is_admin() OR public.is_project_content_editor(project_id));
