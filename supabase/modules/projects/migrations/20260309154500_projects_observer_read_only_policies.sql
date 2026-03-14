-- Observer read-only baseline:
-- - observers can read project, members, tasks, milestones, links, activity
-- - observers can only INSERT links
-- - observers cannot update/delete project, members, tasks, milestones, links

-- Projects: split read/write policies so observers stay read-only.
DROP POLICY IF EXISTS "Project team manage projects" ON public.projects;
DROP POLICY IF EXISTS "Project team view projects" ON public.projects;
DROP POLICY IF EXISTS "Project team create projects" ON public.projects;
DROP POLICY IF EXISTS "Project team update projects" ON public.projects;
DROP POLICY IF EXISTS "Project owners delete projects" ON public.projects;

CREATE POLICY "Project team view projects"
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_project_team_member(id)
    OR public.is_org_admin(organization_id)
  );

CREATE POLICY "Project team create projects"
  ON public.projects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR owner_profile_id = public.current_profile_id()
    OR public.is_org_admin(organization_id)
  );

CREATE POLICY "Project team update projects"
  ON public.projects
  FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR public.is_project_content_editor(id))
  WITH CHECK (public.is_admin() OR public.is_project_content_editor(id));

CREATE POLICY "Project owners delete projects"
  ON public.projects
  FOR DELETE
  TO authenticated
  USING (public.is_admin() OR public.is_project_owner_member(id));

-- Members: readable by all project team; writable by owner/admin only.
DROP POLICY IF EXISTS "Project owners manage project members" ON public.project_members;
DROP POLICY IF EXISTS "Project team view project members" ON public.project_members;
DROP POLICY IF EXISTS "Project owners insert project members" ON public.project_members;
DROP POLICY IF EXISTS "Project owners update project members" ON public.project_members;
DROP POLICY IF EXISTS "Project owners delete project members" ON public.project_members;

CREATE POLICY "Project team view project members"
  ON public.project_members
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.is_project_team_member(project_id));

CREATE POLICY "Project owners insert project members"
  ON public.project_members
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() OR public.is_project_owner_member(project_id));

CREATE POLICY "Project owners update project members"
  ON public.project_members
  FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR public.is_project_owner_member(project_id))
  WITH CHECK (public.is_admin() OR public.is_project_owner_member(project_id));

CREATE POLICY "Project owners delete project members"
  ON public.project_members
  FOR DELETE
  TO authenticated
  USING (public.is_admin() OR public.is_project_owner_member(project_id));

-- Milestones: readable by team; writable by content editors/admin.
DROP POLICY IF EXISTS "Project content editors manage project milestones" ON public.project_milestones;
DROP POLICY IF EXISTS "Project team view project milestones" ON public.project_milestones;
DROP POLICY IF EXISTS "Project content editors insert project milestones" ON public.project_milestones;
DROP POLICY IF EXISTS "Project content editors update project milestones" ON public.project_milestones;
DROP POLICY IF EXISTS "Project content editors delete project milestones" ON public.project_milestones;

CREATE POLICY "Project team view project milestones"
  ON public.project_milestones
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.is_project_team_member(project_id));

CREATE POLICY "Project content editors insert project milestones"
  ON public.project_milestones
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() OR public.is_project_content_editor(project_id));

CREATE POLICY "Project content editors update project milestones"
  ON public.project_milestones
  FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR public.is_project_content_editor(project_id))
  WITH CHECK (public.is_admin() OR public.is_project_content_editor(project_id));

CREATE POLICY "Project content editors delete project milestones"
  ON public.project_milestones
  FOR DELETE
  TO authenticated
  USING (public.is_admin() OR public.is_project_content_editor(project_id));

-- Tasks: readable by team; writable by content editors/admin.
DROP POLICY IF EXISTS "Project content editors manage project tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Project team view project tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Project content editors insert project tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Project content editors update project tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Project content editors delete project tasks" ON public.project_tasks;

CREATE POLICY "Project team view project tasks"
  ON public.project_tasks
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.is_project_team_member(project_id));

CREATE POLICY "Project content editors insert project tasks"
  ON public.project_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() OR public.is_project_content_editor(project_id));

CREATE POLICY "Project content editors update project tasks"
  ON public.project_tasks
  FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR public.is_project_content_editor(project_id))
  WITH CHECK (public.is_admin() OR public.is_project_content_editor(project_id));

CREATE POLICY "Project content editors delete project tasks"
  ON public.project_tasks
  FOR DELETE
  TO authenticated
  USING (public.is_admin() OR public.is_project_content_editor(project_id));
