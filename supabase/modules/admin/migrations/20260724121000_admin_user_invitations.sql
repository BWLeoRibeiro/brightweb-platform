-- Admin-managed app user invitations, ported from MQ.

CREATE TABLE IF NOT EXISTS public.admin_user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invited_email text NOT NULL,
  role_code text NOT NULL REFERENCES public.roles(code) CHECK (role_code IN ('staff', 'admin')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  invited_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  accepted_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_user_invitations_unique_pending_email
  ON public.admin_user_invitations (lower(invited_email))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_admin_user_invitations_status
  ON public.admin_user_invitations (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_user_invitations_email_status
  ON public.admin_user_invitations (lower(invited_email), status);

CREATE OR REPLACE FUNCTION public.touch_admin_user_invitations_updated_at()
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

DROP TRIGGER IF EXISTS trg_touch_admin_user_invitations_updated_at ON public.admin_user_invitations;
CREATE TRIGGER trg_touch_admin_user_invitations_updated_at
BEFORE UPDATE ON public.admin_user_invitations
FOR EACH ROW
EXECUTE FUNCTION public.touch_admin_user_invitations_updated_at();

CREATE OR REPLACE FUNCTION public.normalize_admin_user_invitation_email()
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

DROP TRIGGER IF EXISTS trg_normalize_admin_user_invitation_email ON public.admin_user_invitations;
CREATE TRIGGER trg_normalize_admin_user_invitation_email
BEFORE INSERT OR UPDATE OF invited_email ON public.admin_user_invitations
FOR EACH ROW
EXECUTE FUNCTION public.normalize_admin_user_invitation_email();

ALTER TABLE public.admin_user_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage app user invitations" ON public.admin_user_invitations;
CREATE POLICY "Admins manage app user invitations"
  ON public.admin_user_invitations
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Invited app users view own invitations" ON public.admin_user_invitations;
CREATE POLICY "Invited app users view own invitations"
  ON public.admin_user_invitations
  FOR SELECT
  TO authenticated
  USING (
    status = 'pending'
    AND lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
