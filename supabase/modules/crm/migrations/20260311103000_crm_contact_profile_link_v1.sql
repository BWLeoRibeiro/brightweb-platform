-- Mirror of BrightWeb canonical migration:
-- brightweb-platform/supabase/modules/crm-base/migrations/20260311103000_crm_base_contact_profile_link_v1.sql

ALTER TABLE public.crm_contacts
  ADD COLUMN IF NOT EXISTS profile_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'crm_contacts_profile_id_fkey'
  ) THEN
    ALTER TABLE public.crm_contacts
      ADD CONSTRAINT crm_contacts_profile_id_fkey
      FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END;
$$;

DO $$
BEGIN
  UPDATE public.crm_contacts c
  SET profile_id = NULL,
      updated_at = now()
  FROM (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY profile_id
        ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
      ) AS link_rank
    FROM public.crm_contacts
    WHERE profile_id IS NOT NULL
  ) ranked
  WHERE c.id = ranked.id
    AND ranked.link_rank > 1;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_crm_contacts_profile_id
  ON public.crm_contacts (profile_id)
  WHERE profile_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_profile_id_unique
  ON public.crm_contacts (profile_id)
  WHERE profile_id IS NOT NULL;

UPDATE public.crm_contacts c
SET profile_id = p.id,
    updated_at = now()
FROM public.profiles p
WHERE c.profile_id IS NULL
  AND c.email IS NOT NULL
  AND p.email IS NOT NULL
  AND lower(trim(c.email)) = lower(trim(p.email));
