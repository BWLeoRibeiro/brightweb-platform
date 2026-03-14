-- Mirror of BrightWeb canonical migration:
-- brightweb-platform/supabase/modules/core/migrations/20260311113000_core_profile_transition_cleanup_v1.sql

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_preferred_language_check;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS preferred_language,
  DROP COLUMN IF EXISTS alerts_seen_at;
