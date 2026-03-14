-- Mirror of BrightWeb canonical migration:
-- brightweb-platform/supabase/modules/crm-base/migrations/20260311104000_crm_base_invitation_acceptance_link_v1.sql

ALTER TABLE public.organization_invitations
  ADD COLUMN IF NOT EXISTS accepted_contact_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organization_invitations_accepted_contact_id_fkey'
  ) THEN
    ALTER TABLE public.organization_invitations
      ADD CONSTRAINT organization_invitations_accepted_contact_id_fkey
      FOREIGN KEY (accepted_contact_id) REFERENCES public.crm_contacts(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_organization_invitations_accepted_contact_id
  ON public.organization_invitations (accepted_contact_id)
  WHERE accepted_contact_id IS NOT NULL;

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
