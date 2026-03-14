CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'member')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  invited_by_profile_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  accepted_by_profile_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  accepted_at timestamptz NULL,
  revoked_at timestamptz NULL,
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

CREATE OR REPLACE FUNCTION public.touch_organization_invitations_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_organization_invitations_updated_at ON public.organization_invitations;
CREATE TRIGGER trg_touch_organization_invitations_updated_at
BEFORE UPDATE ON public.organization_invitations
FOR EACH ROW
EXECUTE FUNCTION public.touch_organization_invitations_updated_at();

-- Keep invite emails normalized.
CREATE OR REPLACE FUNCTION public.normalize_organization_invitation_email()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.invited_email = lower(trim(NEW.invited_email));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_organization_invitation_email ON public.organization_invitations;
CREATE TRIGGER trg_normalize_organization_invitation_email
BEFORE INSERT OR UPDATE OF invited_email ON public.organization_invitations
FOR EACH ROW
EXECUTE FUNCTION public.normalize_organization_invitation_email();

ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage organization invitations" ON public.organization_invitations;
DROP POLICY IF EXISTS "Org admins manage organization invitations" ON public.organization_invitations;
DROP POLICY IF EXISTS "Invited users view own invitations" ON public.organization_invitations;

CREATE POLICY "Staff manage organization invitations"
  ON public.organization_invitations
  FOR ALL
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "Org admins manage organization invitations"
  ON public.organization_invitations
  FOR ALL
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));

CREATE POLICY "Invited users view own invitations"
  ON public.organization_invitations
  FOR SELECT
  USING (
    status = 'pending'
    AND lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
