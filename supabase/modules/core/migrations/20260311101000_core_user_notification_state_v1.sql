-- Mirror of BrightWeb canonical migration:
-- brightweb-platform/supabase/modules/core/migrations/20260311101000_core_user_notification_state_v1.sql

CREATE TABLE IF NOT EXISTS public.user_notification_state (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  alerts_seen_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.touch_user_notification_state_updated_at()
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

DROP TRIGGER IF EXISTS trg_touch_user_notification_state_updated_at ON public.user_notification_state;
CREATE TRIGGER trg_touch_user_notification_state_updated_at
BEFORE UPDATE ON public.user_notification_state
FOR EACH ROW
EXECUTE FUNCTION public.touch_user_notification_state_updated_at();

ALTER TABLE public.user_notification_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own notification state" ON public.user_notification_state;
CREATE POLICY "Users view own notification state"
  ON public.user_notification_state
  FOR SELECT
  TO authenticated
  USING (profile_id = public.current_profile_id());

DROP POLICY IF EXISTS "Users insert own notification state" ON public.user_notification_state;
CREATE POLICY "Users insert own notification state"
  ON public.user_notification_state
  FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = public.current_profile_id());

DROP POLICY IF EXISTS "Users update own notification state" ON public.user_notification_state;
CREATE POLICY "Users update own notification state"
  ON public.user_notification_state
  FOR UPDATE
  TO authenticated
  USING (profile_id = public.current_profile_id())
  WITH CHECK (profile_id = public.current_profile_id());

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'alerts_seen_at'
  ) THEN
    INSERT INTO public.user_notification_state (profile_id, alerts_seen_at)
    SELECT
      p.id,
      p.alerts_seen_at
    FROM public.profiles p
    ON CONFLICT (profile_id) DO UPDATE
    SET alerts_seen_at = EXCLUDED.alerts_seen_at,
        updated_at = now();
  ELSE
    INSERT INTO public.user_notification_state (profile_id)
    SELECT p.id
    FROM public.profiles p
    ON CONFLICT (profile_id) DO NOTHING;
  END IF;
END;
$$;
