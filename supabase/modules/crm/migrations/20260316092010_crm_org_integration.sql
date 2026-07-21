-- CRM integration for the independently installable Organizations module.
-- The orgs baseline keeps accepted_contact_id as a plain uuid and omits this
-- trigger so it never references CRM-owned objects during an orgs-only install.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organization_invitations_accepted_contact_id_fkey'
      AND conrelid = 'public.organization_invitations'::regclass
  ) THEN
    ALTER TABLE public.organization_invitations
      ADD CONSTRAINT organization_invitations_accepted_contact_id_fkey
      FOREIGN KEY (accepted_contact_id)
      REFERENCES public.crm_contacts(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

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

UPDATE public.organization_invitations oi
SET accepted_contact_id = (
      SELECT c.id
      FROM public.crm_contacts c
      WHERE (
          oi.accepted_by_profile_id IS NOT NULL
          AND c.profile_id = oi.accepted_by_profile_id
        )
        OR (
          oi.accepted_by_profile_id IS NULL
          AND oi.invited_email IS NOT NULL
          AND c.email IS NOT NULL
          AND lower(trim(c.email)) = lower(trim(oi.invited_email))
        )
      ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC NULLS LAST, c.id DESC
      LIMIT 1
    ),
    updated_at = now()
WHERE oi.accepted_contact_id IS NULL
  AND oi.status = 'accepted';

