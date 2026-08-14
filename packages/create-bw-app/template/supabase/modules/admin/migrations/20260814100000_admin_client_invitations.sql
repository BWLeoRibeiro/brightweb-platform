-- Allow portal clients to be invited before they are associated with an organization.

ALTER TABLE public.admin_user_invitations
  DROP CONSTRAINT IF EXISTS admin_user_invitations_role_code_check;

ALTER TABLE public.admin_user_invitations
  ADD CONSTRAINT admin_user_invitations_role_code_check
  CHECK (role_code IN ('client', 'staff', 'admin'));
