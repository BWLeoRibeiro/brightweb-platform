-- Brightweb core auth/profile synchronization.
-- Keeps profile creation aligned with auth.users without the old marketing coupling.

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
