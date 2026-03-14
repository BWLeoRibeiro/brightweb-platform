-- Ensure every profile has a role assignment row.
-- Missing profiles are backfilled as client and future profiles get client by default.

CREATE OR REPLACE FUNCTION public.ensure_profile_role_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_role_assignments (
    profile_id,
    role_code,
    assigned_at,
    assigned_by_profile_id,
    reason
  )
  VALUES (
    NEW.id,
    'client',
    now(),
    NULL,
    'auto_profile_default_client_role'
  )
  ON CONFLICT (profile_id)
  DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_profile_role_assignment ON public.profiles;
CREATE TRIGGER trg_ensure_profile_role_assignment
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.ensure_profile_role_assignment();

-- Backfill existing profiles that still do not have a role assignment row.
INSERT INTO public.user_role_assignments (
  profile_id,
  role_code,
  assigned_at,
  assigned_by_profile_id,
  reason
)
SELECT
  p.id,
  'client',
  now(),
  NULL,
  'auto_backfill_missing_profile_role'
FROM public.profiles p
LEFT JOIN public.user_role_assignments ura
  ON ura.profile_id = p.id
WHERE ura.profile_id IS NULL;
