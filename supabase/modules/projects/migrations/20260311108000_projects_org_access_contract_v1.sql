-- projects_org_access_contract_v1
-- Make the projects -> crm-base organization access dependency explicit by
-- routing project policies through project-owned adapter helpers.

CREATE OR REPLACE FUNCTION public.is_project_org_admin(target_project_id uuid)
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
      AND public.is_org_admin(p.organization_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_project_org_member(target_project_id uuid)
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
      AND public.is_org_member(p.organization_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.can_create_projects_for_org(target_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_org_admin(target_org_id)
$$;

DROP POLICY IF EXISTS "Project team view projects" ON public.projects;
DROP POLICY IF EXISTS "Project team create projects" ON public.projects;

CREATE POLICY "Project team view projects"
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_project_team_member(id)
    OR public.is_project_org_admin(id)
  );

CREATE POLICY "Project team create projects"
  ON public.projects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR owner_profile_id = public.current_profile_id()
    OR public.can_create_projects_for_org(organization_id)
  );
