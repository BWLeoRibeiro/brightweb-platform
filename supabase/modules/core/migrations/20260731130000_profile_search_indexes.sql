-- Accelerate staff-facing user and member searches without weakening RLS.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS profiles_email_trgm_idx
  ON public.profiles USING gin (email extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS profiles_first_name_trgm_idx
  ON public.profiles USING gin (first_name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS profiles_last_name_trgm_idx
  ON public.profiles USING gin (last_name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS user_role_assignments_assigned_idx
  ON public.user_role_assignments (assigned_at DESC);
CREATE INDEX IF NOT EXISTS user_role_assignments_role_assigned_idx
  ON public.user_role_assignments (role_code, assigned_at DESC);
