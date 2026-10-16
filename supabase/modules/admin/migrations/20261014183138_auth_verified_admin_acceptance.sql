-- auth_verified_admin_acceptance
-- target: admin
-- created_at: 2026-10-14T18:31:38.413Z

-- One atomic statement protects old CLI/manual continue-on-error application:
-- failed prerequisites or later DDL leave every existing guard/function intact.
DO $identity_migration$
BEGIN
  IF to_regprocedure('public.assert_profile_auth_identity_v1()') IS NULL THEN
    RAISE EXCEPTION 'IDENTITY_MIGRATION_REQUIRED: apply Core 20261014183138_protect_profile_identity before Admin/Orgs identity migrations.' USING ERRCODE = '55000';
  END IF;
  PERFORM public.assert_profile_auth_identity_v1();
  EXECUTE $identity_ddl$
-- Core now guards browser identity writes for every global role. Its invoker
-- UPDATE guard also permits the restricted Auth sync when invoked from staff
-- sessions; the former definer guard incorrectly rejected that trusted sync.
DROP TRIGGER IF EXISTS guard_privileged_profile_fields ON public.profiles;
DROP FUNCTION IF EXISTS public.guard_privileged_profile_fields();

-- atomic_admin_invitation_acceptance
-- target: admin
-- created_at: 2026-09-06T10:16:16.616Z

CREATE OR REPLACE FUNCTION public.accept_admin_user_invitation(p_invitation_id uuid, p_profile_id uuid, p_user_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_invitation public.admin_user_invitations%ROWTYPE;
  v_user_id uuid;
  v_old_role text;
BEGIN
  v_user_id := public.lock_confirmed_profile_auth_identity(p_profile_id, p_user_email);
  -- Lock the same ordered set as direct assignment, including terminal retries.
  SELECT * INTO v_invitation FROM public.admin_user_invitations WHERE id = p_invitation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Convite não encontrado.'; END IF;
  PERFORM id FROM public.admin_user_invitations
    WHERE lower(btrim(invited_email)) = lower(btrim(v_invitation.invited_email))
    ORDER BY id FOR UPDATE;
  SELECT * INTO v_invitation FROM public.admin_user_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Convite não encontrado.'; END IF;
  IF lower(btrim(p_user_email)) IS DISTINCT FROM lower(btrim(v_invitation.invited_email)) THEN
    RAISE EXCEPTION 'Este convite pertence a outro email.';
  END IF;
  -- Recheck the profile link after Auth and invitations are locked.
  PERFORM p.id FROM public.profiles p
    WHERE p.id = p_profile_id AND p.user_id = v_user_id
      AND lower(btrim(p.email)) = lower(btrim(v_invitation.invited_email))
    FOR UPDATE OF p;
  IF NOT FOUND THEN RAISE EXCEPTION 'Este convite pertence a outro email.' USING ERRCODE = 'BW002'; END IF;
  IF v_invitation.status = 'accepted' AND v_invitation.accepted_by_profile_id = p_profile_id THEN
    RETURN jsonb_build_object('status', 'accepted', 'role', v_invitation.role_code);
  END IF;
  IF v_invitation.status <> 'pending' THEN RAISE EXCEPTION 'Este convite já não está disponível.'; END IF;
  IF v_invitation.expires_at <= clock_timestamp() THEN
    UPDATE public.admin_user_invitations SET status = 'expired' WHERE id = p_invitation_id;
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  SELECT role_code INTO v_old_role FROM public.user_role_assignments WHERE profile_id = p_profile_id FOR UPDATE;
  INSERT INTO public.user_role_assignments(profile_id, role_code, assigned_by_profile_id, assigned_at, reason)
    VALUES(p_profile_id, v_invitation.role_code, v_invitation.invited_by_profile_id, now(), 'Convite de utilizador do portal aceite.')
    ON CONFLICT(profile_id) DO UPDATE SET role_code = EXCLUDED.role_code,
      assigned_by_profile_id = EXCLUDED.assigned_by_profile_id, assigned_at = EXCLUDED.assigned_at, reason = EXCLUDED.reason;
  IF v_invitation.invited_by_profile_id IS NOT NULL THEN
    INSERT INTO public.role_change_audit(target_profile_id, changed_by_profile_id, old_role_code, new_role_code, reason)
      VALUES(p_profile_id, v_invitation.invited_by_profile_id, v_old_role, v_invitation.role_code, 'Convite de utilizador do portal aceite.');
  END IF;
  UPDATE public.admin_user_invitations SET status = 'accepted', accepted_at = now(), accepted_by_profile_id = p_profile_id
    WHERE id = p_invitation_id;
  PERFORM public.log_app_activity_event('admin', 'admin_user_invitation_accepted', 'admin_user_invitations', p_invitation_id,
    'Convite de utilizador aceite.', jsonb_build_object('email', v_invitation.invited_email, 'role', v_invitation.role_code,
      'status', 'accepted', 'accepted_by_profile_id', p_profile_id), p_profile_id);
  RETURN jsonb_build_object('status', 'accepted', 'role', v_invitation.role_code);
END;
$$;
REVOKE ALL ON FUNCTION public.accept_admin_user_invitation(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_admin_user_invitation(uuid, uuid, text) TO service_role;

-- Bootstrap also touches Auth and profiles. Lock Auth before the advisory and
-- profile locks, so a stale service request cannot overwrite a concurrent email
-- change and a missing-profile INSERT cannot invert the identity lock order.
CREATE OR REPLACE FUNCTION public.bootstrap_first_admin(
  p_user_id uuid,
  p_email text
)
RETURNS TABLE (
  profile_id uuid,
  previous_role_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
  v_auth_email text;
  v_auth_confirmed_at timestamptz;
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

  SELECT lower(trim(u.email)), u.email_confirmed_at
  INTO v_auth_email, v_auth_confirmed_at
  FROM auth.users u
  WHERE u.id = p_user_id
  FOR NO KEY UPDATE;

  IF v_auth_email IS NULL OR v_auth_email <> v_email OR v_auth_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'Auth user and confirmed email do not match'
      USING ERRCODE = '22023';
  END IF;

  IF (SELECT count(*) FROM auth.users WHERE lower(btrim(email)) = v_email) <> 1 THEN
    RAISE EXCEPTION 'Ambiguous Auth identity; reconcile before granting access.' USING ERRCODE = '21000';
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
  ON CONFLICT ON CONSTRAINT user_role_assignments_profile_id_key
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

-- A new package must not silently call pre-repair module RPCs.
CREATE OR REPLACE FUNCTION public.assert_admin_auth_identity_v1()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  expected record;
  actual pg_catalog.pg_proc%ROWTYPE;
BEGIN
  PERFORM public.assert_profile_auth_identity_v1();
  FOR expected IN SELECT * FROM (VALUES
      ('public.accept_admin_user_invitation(uuid,uuid,text)','9a188c42971bb420261b1d61be4cf188',false,'jsonb',true),
      ('public.bootstrap_first_admin(uuid,text)','7492c436da8e3e1721bf2b8a07149f59',true,'record',true)
    ) AS contracts(signature, body_hash, definer, result_type, service_callable)
  LOOP
    SELECT * INTO actual FROM pg_catalog.pg_proc WHERE oid = to_regprocedure(expected.signature);
    IF NOT FOUND OR md5(actual.prosrc) IS DISTINCT FROM expected.body_hash
        OR actual.prosecdef IS DISTINCT FROM expected.definer
        OR actual.prorettype IS DISTINCT FROM to_regtype(expected.result_type)
        OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
        OR pg_catalog.pg_get_userbyid(actual.proowner) IN ('anon', 'authenticated')
        OR has_function_privilege('anon', actual.oid, 'EXECUTE')
        OR has_function_privilege('authenticated', actual.oid, 'EXECUTE')
        OR (expected.service_callable AND NOT has_function_privilege('service_role', actual.oid, 'EXECUTE')) THEN
      RAISE EXCEPTION 'IDENTITY_MIGRATION_REQUIRED: apply complete Core profile_auth_identity_v1 (%).', expected.signature USING ERRCODE = '55000';
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.assert_admin_auth_identity_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_admin_auth_identity_v1() TO service_role;

$identity_ddl$;
  PERFORM public.assert_admin_auth_identity_v1();
END;
$identity_migration$;
