-- Brightweb Organizations v1 baseline.
-- accepted_contact_id intentionally remains a plain nullable uuid here so this
-- foundation module can install without CRM. CRM adds the foreign key and the
-- primary-contact membership trigger in its org integration migration.

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  industry text,
  company_size text,
  budget_range text,
  website_url text,
  address text,
  tax_identifier_value text,
  tax_identifier_kind text,
  tax_identifier_country_code text,
  primary_contact_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizations_tax_identifier_kind_check
    CHECK (
      tax_identifier_kind IS NULL
      OR tax_identifier_kind IN ('vat', 'tax', 'registration', 'other')
    ),
  CONSTRAINT organizations_tax_identifier_country_code_check
    CHECK (
      tax_identifier_country_code IS NULL
      OR tax_identifier_country_code ~ '^[A-Z]{2}$'
    )
);

CREATE INDEX IF NOT EXISTS idx_organizations_primary_contact_id
  ON public.organizations (primary_contact_id);

CREATE INDEX IF NOT EXISTS idx_organizations_tax_identifier_lookup
  ON public.organizations (tax_identifier_country_code, tax_identifier_kind, tax_identifier_value)
  WHERE tax_identifier_value IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_created_at_desc
  ON public.organizations (created_at DESC);

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

CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'member')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  invited_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  accepted_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  accepted_contact_id uuid,
  accepted_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_invitations_unique_org_email
  ON public.organization_invitations (organization_id, invited_email);

CREATE INDEX IF NOT EXISTS idx_organization_invitations_org_status
  ON public.organization_invitations (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_organization_invitations_email_status
  ON public.organization_invitations (invited_email, status);

CREATE INDEX IF NOT EXISTS idx_organization_invitations_accepted_contact_id
  ON public.organization_invitations (accepted_contact_id)
  WHERE accepted_contact_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.touch_organization_invitations_updated_at()
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

DROP TRIGGER IF EXISTS trg_touch_organization_invitations_updated_at ON public.organization_invitations;
CREATE TRIGGER trg_touch_organization_invitations_updated_at
BEFORE UPDATE ON public.organization_invitations
FOR EACH ROW
EXECUTE FUNCTION public.touch_organization_invitations_updated_at();

CREATE OR REPLACE FUNCTION public.normalize_organization_invitation_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.invited_email := lower(trim(NEW.invited_email));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_organization_invitation_email ON public.organization_invitations;
CREATE TRIGGER trg_normalize_organization_invitation_email
BEFORE INSERT OR UPDATE OF invited_email ON public.organization_invitations
FOR EACH ROW
EXECUTE FUNCTION public.normalize_organization_invitation_email();

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "Staff manage organization invitations" ON public.organization_invitations;
CREATE POLICY "Staff manage organization invitations"
  ON public.organization_invitations
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Org admins manage organization invitations" ON public.organization_invitations;
CREATE POLICY "Org admins manage organization invitations"
  ON public.organization_invitations
  FOR ALL
  TO authenticated
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "Invited users view own invitations" ON public.organization_invitations;
CREATE POLICY "Invited users view own invitations"
  ON public.organization_invitations
  FOR SELECT
  TO authenticated
  USING (
    status = 'pending'
    AND lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

INSERT INTO public.organization_members (organization_id, profile_id, role)
SELECT o.id, o.primary_contact_id, 'admin'
FROM public.organizations o
WHERE o.primary_contact_id IS NOT NULL
ON CONFLICT (organization_id, profile_id)
DO UPDATE SET role = 'admin';
