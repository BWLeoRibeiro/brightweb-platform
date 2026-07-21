-- Brightweb CRM v1 baseline.
-- Organizations install first from the orgs module. Cross-module invitation
-- linkage and primary-contact membership synchronization are added by the
-- following CRM org integration migration.

CREATE TABLE IF NOT EXISTS public.crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  first_name text,
  last_name text,
  email text,
  phone text,
  status text NOT NULL DEFAULT 'lead',
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_contacts_status_check CHECK (status IN ('lead', 'qualified', 'proposal', 'won', 'lost'))
);

CREATE INDEX IF NOT EXISTS idx_crm_contacts_organization_id
  ON public.crm_contacts (organization_id);

CREATE INDEX IF NOT EXISTS idx_crm_contacts_owner_id
  ON public.crm_contacts (owner_id);

CREATE INDEX IF NOT EXISTS idx_crm_contacts_profile_id
  ON public.crm_contacts (profile_id)
  WHERE profile_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_email_unique
  ON public.crm_contacts (email)
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_profile_id_unique
  ON public.crm_contacts (profile_id)
  WHERE profile_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_crm_contacts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_crm_contacts_updated_at ON public.crm_contacts;
CREATE TRIGGER set_crm_contacts_updated_at
BEFORE UPDATE ON public.crm_contacts
FOR EACH ROW
EXECUTE FUNCTION public.set_crm_contacts_updated_at();

CREATE TABLE IF NOT EXISTS public.crm_status_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  reason text,
  changed_by_user_id uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_status_log_profile_id
  ON public.crm_status_log (contact_id);

CREATE OR REPLACE FUNCTION public.set_crm_status(
  p_contact_id uuid,
  p_new_status text,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current text;
BEGIN
  SELECT status INTO v_current
  FROM public.crm_contacts
  WHERE id = p_contact_id;

  IF v_current IS NULL THEN
    v_current := 'none';
  END IF;

  IF v_current = p_new_status THEN
    RETURN;
  END IF;

  UPDATE public.crm_contacts
  SET status = p_new_status,
      updated_at = now()
  WHERE id = p_contact_id;

  INSERT INTO public.crm_status_log (
    contact_id,
    previous_status,
    new_status,
    reason,
    changed_by_user_id
  ) VALUES (
    p_contact_id,
    v_current,
    p_new_status,
    p_reason,
    auth.uid()
  );
END;
$$;

ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_status_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage crm contacts" ON public.crm_contacts;
CREATE POLICY "Staff manage crm contacts"
  ON public.crm_contacts
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Staff view crm status log" ON public.crm_status_log;
CREATE POLICY "Staff view crm status log"
  ON public.crm_status_log
  FOR SELECT
  TO authenticated
  USING (public.is_staff());

UPDATE public.crm_contacts c
SET profile_id = p.id,
    updated_at = now()
FROM public.profiles p
WHERE c.profile_id IS NULL
  AND c.email IS NOT NULL
  AND p.email IS NOT NULL
  AND lower(trim(c.email)) = lower(trim(p.email));
