-- Brightweb core v1 baseline.

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  first_name text,
  last_name text,
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_email_key UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id
  ON public.profiles (user_id);

CREATE OR REPLACE FUNCTION public.touch_profiles_updated_at()
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

DROP TRIGGER IF EXISTS trg_touch_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_touch_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.touch_profiles_updated_at();

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_global_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULL::text
$$;

CREATE OR REPLACE FUNCTION public.has_role(target_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT false
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT false
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT false
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can insert own profile" ON public.profiles;
CREATE POLICY "Authenticated users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can update own profile" ON public.profiles;
CREATE POLICY "Authenticated users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can view own profile" ON public.profiles;
CREATE POLICY "Authenticated users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access to profiles" ON public.profiles;
CREATE POLICY "Service role full access to profiles"
  ON public.profiles
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.sync_profile_from_auth_identity(
  p_user_id uuid,
  p_email text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text;
  v_first_name text;
  v_last_name text;
  v_full_name text;
  v_name_parts text[];
BEGIN
  v_email := NULLIF(lower(trim(COALESCE(p_email, ''))), '');

  IF v_email IS NULL THEN
    RETURN;
  END IF;

  v_first_name := NULLIF(trim(COALESCE(p_metadata ->> 'first_name', '')), '');
  v_last_name := NULLIF(trim(COALESCE(p_metadata ->> 'last_name', '')), '');
  v_full_name := NULLIF(
    trim(
      COALESCE(
        p_metadata ->> 'full_name',
        p_metadata ->> 'name',
        p_metadata ->> 'display_name',
        ''
      )
    ),
    ''
  );

  IF v_first_name IS NULL AND v_full_name IS NOT NULL THEN
    v_name_parts := regexp_split_to_array(v_full_name, '\s+');
    IF array_length(v_name_parts, 1) >= 1 THEN
      v_first_name := v_name_parts[1];
    END IF;
    IF array_length(v_name_parts, 1) >= 2 THEN
      v_last_name := array_to_string(v_name_parts[2:array_length(v_name_parts, 1)], ' ');
    END IF;
  END IF;

  INSERT INTO public.profiles (
    user_id,
    email,
    first_name,
    last_name,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    v_email,
    v_first_name,
    v_last_name,
    now(),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    email = EXCLUDED.email,
    first_name = COALESCE(NULLIF(trim(public.profiles.first_name), ''), EXCLUDED.first_name),
    last_name = COALESCE(NULLIF(trim(public.profiles.last_name), ''), EXCLUDED.last_name),
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_auth_user_profile_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  BEGIN
    PERFORM public.sync_profile_from_auth_identity(NEW.id, NEW.email, NEW.raw_user_meta_data);
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'handle_auth_user_profile_sync failed for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_profile_sync ON auth.users;
CREATE TRIGGER on_auth_user_profile_sync
AFTER INSERT OR UPDATE OF email, raw_user_meta_data
ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_auth_user_profile_sync();

DO $$
DECLARE
  auth_user record;
BEGIN
  FOR auth_user IN
    SELECT id, email, raw_user_meta_data
    FROM auth.users
  LOOP
    PERFORM public.sync_profile_from_auth_identity(auth_user.id, auth_user.email, auth_user.raw_user_meta_data);
  END LOOP;
END;
$$;

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

INSERT INTO public.user_preferences (profile_id)
SELECT p.id
FROM public.profiles p
ON CONFLICT (profile_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.user_notification_state (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  alerts_seen_at timestamptz,
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

INSERT INTO public.user_notification_state (profile_id)
SELECT p.id
FROM public.profiles p
ON CONFLICT (profile_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.app_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  domain text NOT NULL,
  event_type text NOT NULL,
  entity_table text NOT NULL,
  entity_id uuid,
  actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  summary text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_app_activity_events_created_at_desc
  ON public.app_activity_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_activity_events_domain_created_at_desc
  ON public.app_activity_events (domain, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_activity_events_entity
  ON public.app_activity_events (entity_table, entity_id);

CREATE INDEX IF NOT EXISTS idx_app_activity_events_actor_profile
  ON public.app_activity_events (actor_profile_id);

ALTER TABLE public.app_activity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view app activity events" ON public.app_activity_events;
CREATE POLICY "Staff can view app activity events"
  ON public.app_activity_events
  FOR SELECT
  TO authenticated
  USING (public.is_staff());

CREATE OR REPLACE FUNCTION public.log_app_activity_event(
  p_domain text,
  p_event_type text,
  p_entity_table text,
  p_entity_id uuid,
  p_summary text,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_actor_profile_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_profile_id uuid;
BEGIN
  v_actor_profile_id := COALESCE(p_actor_profile_id, public.current_profile_id());

  INSERT INTO public.app_activity_events (
    domain,
    event_type,
    entity_table,
    entity_id,
    actor_profile_id,
    summary,
    payload
  )
  VALUES (
    p_domain,
    p_event_type,
    p_entity_table,
    p_entity_id,
    v_actor_profile_id,
    p_summary,
    COALESCE(p_payload, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_app_activity_event(text, text, text, uuid, text, jsonb, uuid)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_app_activity_event(text, text, text, uuid, text, jsonb, uuid)
  FROM anon;
REVOKE ALL ON FUNCTION public.log_app_activity_event(text, text, text, uuid, text, jsonb, uuid)
  FROM authenticated;
GRANT EXECUTE ON FUNCTION public.log_app_activity_event(text, text, text, uuid, text, jsonb, uuid)
  TO service_role;

CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 1 CHECK (count >= 0),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_counters_expires_at
  ON public.rate_limit_counters (expires_at);

REVOKE ALL ON public.rate_limit_counters FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key text,
  p_window_seconds integer,
  p_max_requests integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := timezone('utc', now());
  v_window_seconds integer := GREATEST(1, p_window_seconds);
  v_max_requests integer := GREATEST(1, p_max_requests);
  v_window_start_epoch bigint;
  v_window_start timestamptz;
  v_window_interval interval;
  v_count integer;
  v_reset_at timestamptz;
  v_allowed boolean;
BEGIN
  DELETE FROM public.rate_limit_counters
  WHERE expires_at < v_now;

  v_window_start_epoch := FLOOR(EXTRACT(EPOCH FROM v_now) / v_window_seconds) * v_window_seconds;
  v_window_start := to_timestamp(v_window_start_epoch);
  v_window_interval := make_interval(secs => v_window_seconds);

  INSERT INTO public.rate_limit_counters (key, window_started_at, count, updated_at, expires_at)
  VALUES (p_key, v_window_start, 1, v_now, v_window_start + v_window_interval)
  ON CONFLICT (key) DO UPDATE
    SET count = CASE
      WHEN public.rate_limit_counters.window_started_at = EXCLUDED.window_started_at
        THEN public.rate_limit_counters.count + 1
      ELSE 1
    END,
    window_started_at = EXCLUDED.window_started_at,
    updated_at = v_now,
    expires_at = EXCLUDED.expires_at
  RETURNING count, (window_started_at + v_window_interval) INTO v_count, v_reset_at;

  v_allowed := v_count <= v_max_requests;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'remaining', GREATEST(v_max_requests - v_count, 0),
    'reset_at', v_reset_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO anon, authenticated, service_role;
