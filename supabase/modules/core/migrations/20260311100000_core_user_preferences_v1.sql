-- Mirror of BrightWeb canonical migration:
-- brightweb-platform/supabase/modules/core/migrations/20260311100000_core_user_preferences_v1.sql

CREATE TABLE IF NOT EXISTS public.user_preferences (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  preferred_language text NOT NULL DEFAULT 'pt-PT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_preferences_preferred_language_check
    CHECK (preferred_language IN ('pt-PT', 'en'))
);

CREATE OR REPLACE FUNCTION public.touch_user_preferences_updated_at()
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

DROP TRIGGER IF EXISTS trg_touch_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER trg_touch_user_preferences_updated_at
BEFORE UPDATE ON public.user_preferences
FOR EACH ROW
EXECUTE FUNCTION public.touch_user_preferences_updated_at();

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own preferences" ON public.user_preferences;
CREATE POLICY "Users view own preferences"
  ON public.user_preferences
  FOR SELECT
  TO authenticated
  USING (
    profile_id = public.current_profile_id()
    OR public.is_staff()
  );

DROP POLICY IF EXISTS "Users insert own preferences" ON public.user_preferences;
CREATE POLICY "Users insert own preferences"
  ON public.user_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id = public.current_profile_id()
    OR public.is_staff()
  );

DROP POLICY IF EXISTS "Users update own preferences" ON public.user_preferences;
CREATE POLICY "Users update own preferences"
  ON public.user_preferences
  FOR UPDATE
  TO authenticated
  USING (
    profile_id = public.current_profile_id()
    OR public.is_staff()
  )
  WITH CHECK (
    profile_id = public.current_profile_id()
    OR public.is_staff()
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'preferred_language'
  ) THEN
    INSERT INTO public.user_preferences (profile_id, preferred_language)
    SELECT
      p.id,
      COALESCE(NULLIF(trim(p.preferred_language), ''), 'pt-PT')
    FROM public.profiles p
    ON CONFLICT (profile_id) DO UPDATE
    SET preferred_language = EXCLUDED.preferred_language,
        updated_at = now();
  ELSE
    INSERT INTO public.user_preferences (profile_id)
    SELECT p.id
    FROM public.profiles p
    ON CONFLICT (profile_id) DO NOTHING;
  END IF;
END;
$$;
