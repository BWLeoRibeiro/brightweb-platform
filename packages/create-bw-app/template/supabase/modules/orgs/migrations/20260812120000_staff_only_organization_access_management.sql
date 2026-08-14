-- Organization roles remain useful client-facing membership metadata, but
-- only global staff and administrators may manage members or invitations.
DROP POLICY IF EXISTS "Org admins manage org members"
  ON public.organization_members;

DROP POLICY IF EXISTS "Org admins manage organization invitations"
  ON public.organization_invitations;
