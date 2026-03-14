-- Restrict project visibility/editing to team members (owner + project_members)
-- while keeping admin global access and org-admin read visibility.

CREATE OR REPLACE FUNCTION public.is_project_team_member(target_project_id uuid)
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
        )
      )
  )
$$;

-- Projects
DROP POLICY IF EXISTS "Staff manage projects" ON public.projects;
DROP POLICY IF EXISTS "Project team manage projects" ON public.projects;
DROP POLICY IF EXISTS "Staff create projects" ON public.projects;

CREATE POLICY "Project team manage projects"
  ON public.projects
  FOR ALL
  TO authenticated
  USING (public.is_admin() OR public.is_project_team_member(id))
  WITH CHECK (
    public.is_admin()
    OR public.is_project_team_member(id)
    OR owner_profile_id = public.current_profile_id()
    OR public.is_org_admin(organization_id)
  );

-- Related tables: keep admin global access, scope staff to project team.
DROP POLICY IF EXISTS "Staff manage project members" ON public.project_members;
DROP POLICY IF EXISTS "Project team manage project members" ON public.project_members;
CREATE POLICY "Project team manage project members"
  ON public.project_members
  FOR ALL
  TO authenticated
  USING (public.is_admin() OR public.is_project_team_member(project_id))
  WITH CHECK (public.is_admin() OR public.is_project_team_member(project_id));

DROP POLICY IF EXISTS "Staff manage project milestones" ON public.project_milestones;
DROP POLICY IF EXISTS "Project team manage project milestones" ON public.project_milestones;
CREATE POLICY "Project team manage project milestones"
  ON public.project_milestones
  FOR ALL
  TO authenticated
  USING (public.is_admin() OR public.is_project_team_member(project_id))
  WITH CHECK (public.is_admin() OR public.is_project_team_member(project_id));

DROP POLICY IF EXISTS "Staff manage project tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Project team manage project tasks" ON public.project_tasks;
CREATE POLICY "Project team manage project tasks"
  ON public.project_tasks
  FOR ALL
  TO authenticated
  USING (public.is_admin() OR public.is_project_team_member(project_id))
  WITH CHECK (public.is_admin() OR public.is_project_team_member(project_id));

DROP POLICY IF EXISTS "Staff manage project links" ON public.project_links;
DROP POLICY IF EXISTS "Project team manage project links" ON public.project_links;
CREATE POLICY "Project team manage project links"
  ON public.project_links
  FOR ALL
  TO authenticated
  USING (public.is_admin() OR public.is_project_team_member(project_id))
  WITH CHECK (public.is_admin() OR public.is_project_team_member(project_id));

DROP POLICY IF EXISTS "Staff view project status log" ON public.project_status_log;
DROP POLICY IF EXISTS "Project team view project status log" ON public.project_status_log;
CREATE POLICY "Project team view project status log"
  ON public.project_status_log
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.is_project_team_member(project_id));
