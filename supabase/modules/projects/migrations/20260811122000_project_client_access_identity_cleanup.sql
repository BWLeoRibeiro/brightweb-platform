-- bw-migration-safety: destructive
-- Destructively normalize legacy project identities only after all readers and
-- writers use the explicit internal-team and client-audience model.

DELETE FROM public.project_members member
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_role_assignments role_assignment
  WHERE role_assignment.profile_id = member.profile_id
    AND role_assignment.role_code IN ('staff', 'admin')
);

-- The enforcement migration intentionally rejects unauthenticated identity
-- changes. Temporarily disable only that column guard for this reviewed,
-- destructive normalization; deferred consistency checks remain active.
ALTER TABLE public.projects DISABLE TRIGGER trg_protect_project_identity_fields;

UPDATE public.projects project
SET owner_profile_id = NULL
WHERE owner_profile_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_role_assignments role_assignment
    WHERE role_assignment.profile_id = project.owner_profile_id
      AND role_assignment.role_code IN ('staff', 'admin')
  );

ALTER TABLE public.projects ENABLE TRIGGER trg_protect_project_identity_fields;

-- Existing owner_profile_id is canonical during cleanup. Keep exactly its
-- matching owner membership and demote stale owner rows.
UPDATE public.project_members member
SET role = 'contributor'
FROM public.projects project
WHERE project.id = member.project_id
  AND member.role = 'owner'
  AND member.profile_id IS DISTINCT FROM project.owner_profile_id;

DELETE FROM public.project_members member
USING public.projects project
WHERE project.id = member.project_id
  AND project.owner_profile_id IS NULL
  AND member.role = 'owner';

INSERT INTO public.project_members (project_id, profile_id, role)
SELECT project.id, project.owner_profile_id, 'owner'
FROM public.projects project
WHERE project.owner_profile_id IS NOT NULL
ON CONFLICT (project_id, profile_id)
DO UPDATE SET role = 'owner';

CREATE OR REPLACE FUNCTION public.enforce_internal_project_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  -- Keep table-specific NEW fields in separate statements. A CASE expression
  -- still asks PostgreSQL to resolve both record fields and fails on projects
  -- because that row type has no profile_id column.
  IF TG_TABLE_NAME = 'projects' THEN
    v_profile_id := NEW.owner_profile_id;
  ELSE
    v_profile_id := NEW.profile_id;
  END IF;

  IF v_profile_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.user_role_assignments role_assignment
    WHERE role_assignment.profile_id = v_profile_id
      AND role_assignment.role_code IN ('staff', 'admin')
  ) THEN
    RAISE EXCEPTION 'Project owners and members must be internal staff.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_internal_project_owner ON public.projects;
CREATE TRIGGER trg_enforce_internal_project_owner
BEFORE INSERT OR UPDATE OF owner_profile_id ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.enforce_internal_project_identity();

DROP TRIGGER IF EXISTS trg_enforce_internal_project_member ON public.project_members;
CREATE TRIGGER trg_enforce_internal_project_member
BEFORE INSERT OR UPDATE OF profile_id, role ON public.project_members
FOR EACH ROW
EXECUTE FUNCTION public.enforce_internal_project_identity();

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
  IF TG_TABLE_NAME = 'projects' THEN
    v_project_id := COALESCE(NEW.id, OLD.id);
  ELSE
    v_project_id := COALESCE(NEW.project_id, OLD.project_id);
  END IF;

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

CREATE OR REPLACE FUNCTION public.validate_project_primary_participation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id uuid := COALESCE(NEW.project_id, OLD.project_id);
  v_primary_organization_id uuid;
  v_matching_primary_count integer;
  v_other_primary_count integer;
BEGIN
  SELECT project.organization_id
  INTO v_primary_organization_id
  FROM public.projects project
  WHERE project.id = v_project_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT
    count(*) FILTER (
      WHERE participant.organization_id = v_primary_organization_id
        AND participant.is_primary
    ),
    count(*) FILTER (
      WHERE participant.is_primary
        AND participant.organization_id <> v_primary_organization_id
    )
  INTO v_matching_primary_count, v_other_primary_count
  FROM public.project_organizations participant
  WHERE participant.project_id = v_project_id;

  IF v_matching_primary_count <> 1 OR v_other_primary_count <> 0 THEN
    RAISE EXCEPTION 'The project primary organization must be its only primary participant.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_project_primary_participation
  ON public.project_organizations;
CREATE CONSTRAINT TRIGGER trg_validate_project_primary_participation
AFTER INSERT OR UPDATE OR DELETE ON public.project_organizations
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.validate_project_primary_participation();
