-- Keep organization primary contacts synced as org admins.
-- This ensures account-side org-admin access can rely on organization_members consistently.

CREATE OR REPLACE FUNCTION public.sync_org_primary_contact_admin_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.primary_contact_id IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, profile_id, role)
    VALUES (NEW.id, NEW.primary_contact_id, 'admin')
    ON CONFLICT (organization_id, profile_id)
    DO UPDATE SET role = 'admin';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_org_primary_contact_admin_membership ON public.organizations;
CREATE TRIGGER trg_sync_org_primary_contact_admin_membership
AFTER INSERT OR UPDATE OF primary_contact_id ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.sync_org_primary_contact_admin_membership();

-- Backfill current organizations so existing primary contacts are also org admins.
INSERT INTO public.organization_members (organization_id, profile_id, role)
SELECT o.id, o.primary_contact_id, 'admin'
FROM public.organizations o
WHERE o.primary_contact_id IS NOT NULL
ON CONFLICT (organization_id, profile_id)
DO UPDATE SET role = 'admin';
