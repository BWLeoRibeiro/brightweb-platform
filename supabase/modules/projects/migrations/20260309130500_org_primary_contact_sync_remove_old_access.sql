-- Keep organization primary-contact changes consistent with org admin + project observer allocations.
-- Future updates: remove old primary contact access/allocation and add new one.

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

      DELETE FROM public.project_members pm
      USING public.projects p
      WHERE p.id = pm.project_id
        AND p.organization_id = NEW.id
        AND pm.profile_id = OLD.primary_contact_id
        AND pm.role = 'observer';
    END IF;
  END IF;

  IF NEW.primary_contact_id IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, profile_id, role)
    VALUES (NEW.id, NEW.primary_contact_id, 'admin')
    ON CONFLICT (organization_id, profile_id)
    DO UPDATE SET role = 'admin';

    INSERT INTO public.project_members (project_id, profile_id, role)
    SELECT p.id, NEW.primary_contact_id, 'observer'
    FROM public.projects p
    WHERE p.organization_id = NEW.id
    ON CONFLICT (project_id, profile_id)
    DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_org_primary_contact_admin_membership ON public.organizations;
CREATE TRIGGER trg_sync_org_primary_contact_admin_membership
AFTER INSERT OR UPDATE OF primary_contact_id ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.sync_org_primary_contact_admin_membership();

-- Backfill current primary contacts as org admins and observer members in project teams.
INSERT INTO public.organization_members (organization_id, profile_id, role)
SELECT o.id, o.primary_contact_id, 'admin'
FROM public.organizations o
WHERE o.primary_contact_id IS NOT NULL
ON CONFLICT (organization_id, profile_id)
DO UPDATE SET role = 'admin';

INSERT INTO public.project_members (project_id, profile_id, role)
SELECT p.id, o.primary_contact_id, 'observer'
FROM public.projects p
JOIN public.organizations o ON o.id = p.organization_id
WHERE o.primary_contact_id IS NOT NULL
ON CONFLICT (project_id, profile_id)
DO NOTHING;
