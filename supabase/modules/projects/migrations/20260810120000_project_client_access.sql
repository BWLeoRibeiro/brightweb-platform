-- Explicit client audiences and staff/client data boundaries for projects.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_access_mode text NOT NULL DEFAULT 'hidden';

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_status_check
  CHECK (status IN ('planned', 'active', 'paused', 'blocked', 'completed', 'canceled'));

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_client_access_mode_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_client_access_mode_check
  CHECK (client_access_mode IN ('hidden', 'all_org_clients', 'selected_clients'));

CREATE INDEX IF NOT EXISTS idx_projects_archived_at
  ON public.projects (archived_at)
  WHERE archived_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_client_access_mode
  ON public.projects (client_access_mode)
  WHERE client_access_mode <> 'hidden';

ALTER TABLE public.project_status_log
  DROP CONSTRAINT IF EXISTS project_status_log_new_status_check;
ALTER TABLE public.project_status_log
  ADD CONSTRAINT project_status_log_new_status_check
  CHECK (new_status IN ('planned', 'active', 'paused', 'blocked', 'completed', 'canceled'));

CREATE OR REPLACE FUNCTION public.sync_project_lifecycle_dates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('active', 'blocked', 'paused', 'completed')
    AND NEW.activated_at IS NULL THEN
    NEW.activated_at := now();
  END IF;

  IF NEW.status = 'completed'
    AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  END IF;

  RETURN NEW;
END;
$$;

ALTER TABLE public.project_milestones
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'staff';

ALTER TABLE public.project_milestones
  DROP CONSTRAINT IF EXISTS project_milestones_visibility_check;
ALTER TABLE public.project_milestones
  ADD CONSTRAINT project_milestones_visibility_check
  CHECK (visibility IN ('staff', 'client'));

CREATE INDEX IF NOT EXISTS idx_project_milestones_client_visibility
  ON public.project_milestones (project_id, position)
  WHERE visibility = 'client';

CREATE TABLE IF NOT EXISTS public.project_client_organizations (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  added_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_project_client_organizations_org_project
  ON public.project_client_organizations (organization_id, project_id);

CREATE TABLE IF NOT EXISTS public.project_client_profiles (
  project_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  granted_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, organization_id, profile_id),
  CONSTRAINT project_client_profiles_project_org_fkey
    FOREIGN KEY (project_id, organization_id)
    REFERENCES public.project_client_organizations(project_id, organization_id)
    ON DELETE CASCADE,
  CONSTRAINT project_client_profiles_org_membership_fkey
    FOREIGN KEY (organization_id, profile_id)
    REFERENCES public.organization_members(organization_id, profile_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_client_profiles_profile_project
  ON public.project_client_profiles (profile_id, project_id);

ALTER TABLE public.project_client_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_client_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage project client organizations"
  ON public.project_client_organizations;
CREATE POLICY "Staff manage project client organizations"
  ON public.project_client_organizations
  FOR ALL
  TO authenticated
  USING (
    public.is_admin()
    OR (
      public.is_staff()
      AND public.is_project_owner_member(project_id)
    )
  )
  WITH CHECK (
    public.is_admin()
    OR (
      public.is_staff()
      AND public.is_project_owner_member(project_id)
    )
  );

DROP POLICY IF EXISTS "Staff manage project client profiles"
  ON public.project_client_profiles;
CREATE POLICY "Staff manage project client profiles"
  ON public.project_client_profiles
  FOR ALL
  TO authenticated
  USING (
    public.is_admin()
    OR (
      public.is_staff()
      AND public.is_project_owner_member(project_id)
    )
  )
  WITH CHECK (
    public.is_admin()
    OR (
      public.is_staff()
      AND public.is_project_owner_member(project_id)
    )
  );

-- Existing projects retain their primary organization as the initial audience
-- candidate, but hidden remains the safe default until staff explicitly shares.
INSERT INTO public.project_client_organizations (project_id, organization_id)
SELECT project.id, project.organization_id
FROM public.projects project
ON CONFLICT (project_id, organization_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.can_current_client_view_project(target_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_global_role() = 'client', false)
    AND EXISTS (
      SELECT 1
      FROM public.projects project
      JOIN public.project_client_organizations client_org
        ON client_org.project_id = project.id
      JOIN public.organization_members org_member
        ON org_member.organization_id = client_org.organization_id
       AND org_member.profile_id = public.current_profile_id()
      WHERE project.id = target_project_id
        AND project.client_access_mode <> 'hidden'
        AND (
          project.client_access_mode = 'all_org_clients'
          OR (
            project.client_access_mode = 'selected_clients'
            AND EXISTS (
              SELECT 1
              FROM public.project_client_profiles client_profile
              WHERE client_profile.project_id = project.id
                AND client_profile.organization_id = client_org.organization_id
                AND client_profile.profile_id = public.current_profile_id()
            )
          )
        )
    )
$$;

REVOKE ALL ON FUNCTION public.can_current_client_view_project(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_current_client_view_project(uuid)
  TO authenticated, service_role;

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
BEGIN
  IF target_mode IS NULL
    OR target_mode NOT IN ('hidden', 'all_org_clients', 'selected_clients') THEN
    RAISE EXCEPTION 'Invalid project client access mode.'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(v_profile_grants) <> 'array' THEN
    RAISE EXCEPTION 'Profile grants must be a JSON array.'
      USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.projects
  WHERE id = target_project_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projeto não encontrado.'
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    public.is_admin()
    OR (
      public.is_staff()
      AND public.is_project_owner_member(target_project_id)
    )
  ) THEN
    RAISE EXCEPTION 'Only project owners or administrators can manage client project access.'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(v_organization_ids) AS selected(organization_id)
    WHERE selected.organization_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Organization IDs cannot contain null values.'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(v_organization_ids) AS selected(organization_id)
    LEFT JOIN public.organizations organization
      ON organization.id = selected.organization_id
    WHERE organization.id IS NULL
  ) THEN
    RAISE EXCEPTION 'One or more organizations do not exist.'
      USING ERRCODE = '22023';
  END IF;

  IF target_mode <> 'hidden'
    AND COALESCE(array_length(v_organization_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Visible client access requires at least one organization.'
      USING ERRCODE = '22023';
  END IF;

  IF target_mode = 'selected_clients'
    AND jsonb_array_length(v_profile_grants) = 0 THEN
    RAISE EXCEPTION 'Selected-clients mode requires at least one profile grant.'
      USING ERRCODE = '22023';
  END IF;

  IF target_mode = 'selected_clients'
    AND EXISTS (
      SELECT 1
      FROM jsonb_to_recordset(v_profile_grants)
        AS access_grant(organization_id uuid, profile_id uuid)
      LEFT JOIN public.organization_members org_member
        ON org_member.organization_id = access_grant.organization_id
       AND org_member.profile_id = access_grant.profile_id
      LEFT JOIN public.user_role_assignments role_assignment
        ON role_assignment.profile_id = access_grant.profile_id
       AND role_assignment.role_code = 'client'
      WHERE access_grant.organization_id IS NULL
        OR access_grant.profile_id IS NULL
        OR NOT (access_grant.organization_id = ANY(v_organization_ids))
        OR org_member.id IS NULL
        OR role_assignment.id IS NULL
    ) THEN
    RAISE EXCEPTION 'Every selected profile must be an active client member of a selected organization.'
      USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.project_client_organizations
  WHERE project_id = target_project_id;

  INSERT INTO public.project_client_organizations (
    project_id,
    organization_id,
    added_by_profile_id
  )
  SELECT target_project_id, organization_id, v_actor_profile_id
  FROM (
    SELECT DISTINCT selected.organization_id
    FROM unnest(v_organization_ids) AS selected(organization_id)
  ) selected_organizations;

  IF target_mode = 'selected_clients' THEN
    INSERT INTO public.project_client_profiles (
      project_id,
      organization_id,
      profile_id,
      granted_by_profile_id
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
END;
$$;

REVOKE ALL ON FUNCTION public.set_project_client_access(uuid, text, uuid[], jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_project_client_access(uuid, text, uuid[], jsonb)
  TO authenticated;
