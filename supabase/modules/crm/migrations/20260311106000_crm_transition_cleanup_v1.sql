-- Mirror of BrightWeb canonical migration:
-- brightweb-platform/supabase/modules/crm-base/migrations/20260311106000_crm_base_transition_cleanup_v1.sql

ALTER FUNCTION public.normalize_organization_invitation_email() SET search_path = public;
ALTER FUNCTION public.touch_organization_invitations_updated_at() SET search_path = public;

ALTER TABLE public.organizations
  DROP COLUMN IF EXISTS nif;
