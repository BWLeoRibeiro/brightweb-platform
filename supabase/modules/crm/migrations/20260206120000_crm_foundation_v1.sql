-- Brightweb CRM baseline.
-- Canonical greenfield replacement for the old BeGreen phase-2 CRM and org-membership setup.

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  industry text,
  company_size text,
  budget_range text,
  website_url text,
  primary_contact_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organizations_primary_contact_id_fkey'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_primary_contact_id_fkey
      FOREIGN KEY (primary_contact_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_organizations_primary_contact_id
  ON public.organizations (primary_contact_id);

CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_members_role_check CHECK (role IN ('admin', 'member')),
  CONSTRAINT organization_members_unique UNIQUE (organization_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_members_profile_id
  ON public.organization_members (profile_id);

CREATE OR REPLACE FUNCTION public.is_org_admin(target_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = target_org_id
      AND om.profile_id = public.current_profile_id()
      AND om.role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(target_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = target_org_id
      AND om.profile_id = public.current_profile_id()
  )
$$;

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

CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_email_unique
  ON public.crm_contacts (email)
  WHERE email IS NOT NULL;

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

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_status_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage organizations" ON public.organizations;
CREATE POLICY "Staff manage organizations"
  ON public.organizations
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Staff manage org members" ON public.organization_members;
CREATE POLICY "Staff manage org members"
  ON public.organization_members
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Org admins manage org members" ON public.organization_members;
CREATE POLICY "Org admins manage org members"
  ON public.organization_members
  FOR ALL
  TO authenticated
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "Members view own org membership" ON public.organization_members;
CREATE POLICY "Members view own org membership"
  ON public.organization_members
  FOR SELECT
  TO authenticated
  USING (profile_id = public.current_profile_id());

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
