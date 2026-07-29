-- Removes the p_force escape hatch from `bw admin create`.
-- The 3-arg signature is already applied in production, so drop and recreate.

DROP FUNCTION IF EXISTS public.bootstrap_first_admin(uuid, text, boolean);

CREATE FUNCTION public.bootstrap_first_admin(
  p_user_id uuid,
  p_email text
)
RETURNS TABLE (
  profile_id uuid,
  previous_role_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text;
  v_auth_email text;
  v_profile_id uuid;
  v_previous_role_code text;
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'bootstrap_first_admin requires service_role'
      USING ERRCODE = '42501';
  END IF;

  v_email := NULLIF(lower(trim(COALESCE(p_email, ''))), '');
  IF p_user_id IS NULL OR v_email IS NULL THEN
    RAISE EXCEPTION 'A user id and email are required'
      USING ERRCODE = '22023';
  END IF;

  SELECT lower(trim(u.email))
  INTO v_auth_email
  FROM auth.users u
  WHERE u.id = p_user_id;

  IF v_auth_email IS NULL OR v_auth_email <> v_email THEN
    RAISE EXCEPTION 'Auth user and email do not match'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('brightweb:first-admin-bootstrap', 0));

  IF EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    WHERE ura.role_code = 'admin'
  ) THEN
    RAISE EXCEPTION 'A project administrator already exists'
      USING ERRCODE = '42501';
  END IF;

  SELECT p.id
  INTO v_profile_id
  FROM public.profiles p
  WHERE p.user_id = p_user_id
  FOR UPDATE;

  IF v_profile_id IS NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE lower(p.email) = v_email
    ) THEN
      RAISE EXCEPTION 'A profile already exists for this email'
        USING ERRCODE = '23505';
    END IF;

    INSERT INTO public.profiles (user_id, email)
    VALUES (p_user_id, v_email)
    RETURNING id INTO v_profile_id;
  ELSE
    UPDATE public.profiles
    SET email = v_email,
        updated_at = now()
    WHERE id = v_profile_id;
  END IF;

  SELECT ura.role_code
  INTO v_previous_role_code
  FROM public.user_role_assignments ura
  WHERE ura.profile_id = v_profile_id
  FOR UPDATE;

  INSERT INTO public.user_role_assignments (
    profile_id,
    role_code,
    assigned_by_profile_id,
    assigned_at,
    reason
  )
  VALUES (
    v_profile_id,
    'admin',
    NULL,
    now(),
    'bw_admin_create_bootstrap'
  )
  ON CONFLICT (profile_id)
  DO UPDATE SET
    role_code = EXCLUDED.role_code,
    assigned_by_profile_id = NULL,
    assigned_at = EXCLUDED.assigned_at,
    reason = EXCLUDED.reason;

  RETURN QUERY SELECT v_profile_id, v_previous_role_code;
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_first_admin(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bootstrap_first_admin(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.bootstrap_first_admin(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin(uuid, text) TO service_role;
