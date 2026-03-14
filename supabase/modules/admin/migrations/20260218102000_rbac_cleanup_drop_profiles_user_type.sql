-- RBAC big-bang cleanup: remove legacy role field from profiles

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_user_type_check;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS user_type;
