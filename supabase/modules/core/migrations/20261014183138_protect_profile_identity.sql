-- protect_profile_identity
-- target: core
-- created_at: 2026-10-14T18:31:38.339Z

-- One atomic statement protects old CLI/manual continue-on-error application:
-- failed prerequisites or later DDL leave every existing guard/function intact.
DO $identity_migration$
BEGIN
  EXECUTE $identity_ddl$
-- Browser UPDATE already owns a profile lock. Reject identity changes without
-- touching Auth, so an Auth email change (Auth -> profile) cannot deadlock it.
-- This guard is INVOKER: nested trusted Auth sync retains its effective owner;
-- ordinary browser roles never receive that authority via a definer guard.
CREATE OR REPLACE FUNCTION public.guard_profile_identity_update()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND (
    NEW.email IS DISTINCT FROM OLD.email OR
    NEW.user_id IS DISTINCT FROM OLD.user_id OR
    NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Profile identity is managed by Auth.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_profile_identity_update() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE TRIGGER guard_profile_identity_update BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_identity_update();

-- BEFORE INSERT runs before uniqueness/conflict locks, including on an upsert.
-- SHARE conflicts with Auth email UPDATE; KEY SHARE would not protect email.
-- Existing account upserts omit created_at, so preserve its original value.
CREATE OR REPLACE FUNCTION public.guard_profile_identity_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_email text;
  v_created_at timestamptz;
BEGIN
  IF current_setting('role', true) IN ('anon', 'authenticated') AND
      (NEW.user_id IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid()) THEN
    RAISE EXCEPTION 'Profile identity is managed by Auth.' USING ERRCODE = '42501';
  END IF;
  IF NEW.user_id IS NOT NULL THEN
    SELECT lower(btrim(email)) INTO v_email FROM auth.users
      WHERE id = NEW.user_id FOR SHARE;
    IF NOT FOUND OR v_email IS NULL OR v_email = '' OR
        lower(btrim(NEW.email)) IS DISTINCT FROM v_email THEN
      RAISE EXCEPTION 'Profile identity is managed by Auth.' USING ERRCODE = '42501';
    END IF;
    NEW.email := v_email;
  END IF;
  SELECT created_at INTO v_created_at FROM public.profiles WHERE user_id = NEW.user_id;
  IF current_setting('role', true) IN ('anon', 'authenticated') THEN
    IF NEW.created_at IS DISTINCT FROM now() AND
        NEW.created_at IS DISTINCT FROM v_created_at THEN
      RAISE EXCEPTION 'Profile creation timestamp is managed by the database.' USING ERRCODE = '42501';
    END IF;
    NEW.created_at := COALESCE(v_created_at, now());
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_profile_identity_insert() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE TRIGGER guard_profile_identity_insert BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_identity_insert();

CREATE OR REPLACE FUNCTION public.sync_profile_from_auth_identity(
  p_user_id uuid,
  p_email text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
  v_first_name text;
  v_last_name text;
  v_full_name text;
  v_name_parts text[];
BEGIN
  -- Keep the legacy argument for callers, but only current Auth state is authority.
  -- Lock Auth before the upsert takes any profile locks; stale registration input
  -- must never restore an email which Auth has already changed.
  SELECT NULLIF(lower(btrim(u.email)), '') INTO v_email
    FROM auth.users u WHERE u.id = p_user_id FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auth identity not found.' USING ERRCODE = '23503';
  END IF;

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

REVOKE ALL ON FUNCTION public.sync_profile_from_auth_identity(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sync_profile_from_auth_identity(uuid,text,jsonb) TO service_role;

-- Narrow server boundary: no auth table grants or browser email lookup.
-- More than one normalized identity is an error, never a silent legacy relink.
CREATE OR REPLACE FUNCTION public.resolve_auth_identity(p_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user_id uuid;
  v_profile_id uuid;
  v_identities jsonb;
  v_confirmed boolean;
BEGIN
  SELECT jsonb_agg(jsonb_build_object('userId', id,
    'confirmed', email_confirmed_at IS NOT NULL)) INTO v_identities
    FROM auth.users WHERE lower(btrim(email)) = lower(btrim(p_email));
  IF v_identities IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(btrim(email)) = lower(btrim(p_email))) THEN
      RAISE EXCEPTION 'IDENTITY_RECONCILIATION_REQUIRED: existing profile has no matching Auth identity.' USING ERRCODE = 'BW002';
    END IF;
    RETURN NULL;
  END IF;
  IF jsonb_array_length(v_identities) <> 1 THEN
    RAISE EXCEPTION 'Ambiguous Auth identity; reconcile before granting access.' USING ERRCODE = '21000';
  END IF;
  v_user_id := (v_identities -> 0 ->> 'userId')::uuid;
  v_confirmed := (v_identities -> 0 ->> 'confirmed')::boolean;
  IF EXISTS (SELECT 1 FROM public.profiles
      WHERE (user_id = v_user_id AND lower(btrim(email)) IS DISTINCT FROM lower(btrim(p_email)))
        OR (lower(btrim(email)) = lower(btrim(p_email)) AND user_id IS DISTINCT FROM v_user_id)) THEN
    RAISE EXCEPTION 'IDENTITY_RECONCILIATION_REQUIRED: profile and current Auth identity disagree.' USING ERRCODE = 'BW002';
  END IF;
  SELECT id INTO v_profile_id FROM public.profiles
    WHERE user_id = v_user_id AND v_confirmed AND lower(btrim(email)) = lower(btrim(p_email));
  RETURN jsonb_build_object('userId', v_user_id, 'profileId', v_profile_id,
    'email', lower(btrim(p_email)), 'confirmed', v_confirmed);
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_auth_identity(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_auth_identity(text) TO service_role;

-- The profile read is only a candidate snapshot. Callers must recheck user_id
-- under their later profile lock. This function must precede invitation locks.
CREATE OR REPLACE FUNCTION public.lock_confirmed_profile_auth_identity(p_profile_id uuid, p_email text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_confirmed_at timestamptz;
BEGIN
  SELECT user_id INTO v_user_id FROM public.profiles WHERE id = p_profile_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'O perfil não corresponde ao email confirmado; este convite pertence a outro email.' USING ERRCODE = 'BW002';
  END IF;
  SELECT email, email_confirmed_at INTO v_email, v_confirmed_at
    FROM auth.users WHERE id = v_user_id FOR NO KEY UPDATE;
  IF NOT FOUND OR v_confirmed_at IS NULL OR p_email IS NULL OR btrim(p_email) = '' OR
      lower(btrim(v_email)) IS DISTINCT FROM lower(btrim(p_email)) THEN
    RAISE EXCEPTION 'O perfil não corresponde ao email confirmado; este convite pertence a outro email.';
  END IF;
  IF (SELECT count(*) FROM auth.users WHERE lower(btrim(email)) = lower(btrim(p_email))) <> 1 THEN
    RAISE EXCEPTION 'Ambiguous Auth identity; reconcile before granting access.' USING ERRCODE = '21000';
  END IF;
  RETURN v_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.lock_confirmed_profile_auth_identity(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lock_confirmed_profile_auth_identity(uuid,text) TO service_role;

-- Installed last: dependents validate both complete installation and subsequent
-- catalog drift. The whole migration is one statement, including this check.
CREATE OR REPLACE FUNCTION public.assert_profile_auth_identity_v1()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  expected record;
  actual pg_catalog.pg_proc%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute
      WHERE attrelid = 'auth.users'::regclass AND attname = 'email_confirmed_at' AND NOT attisdropped) THEN
    RAISE EXCEPTION 'IDENTITY_MIGRATION_REQUIRED: Core Auth confirmation schema is missing.' USING ERRCODE = '55000';
  END IF;
  FOR expected IN SELECT * FROM (VALUES
      ('public.guard_profile_identity_update()','bf0274d7fd4c164296db7363b1678989',false,'trigger',false),
      ('public.guard_profile_identity_insert()','14dc0765f2ab4d343c51a76f29c71909',true,'trigger',false),
      ('public.sync_profile_from_auth_identity(uuid,text,jsonb)','c94aa40d153e255d8108c43c4c5ad21e',true,'void',true),
      ('public.resolve_auth_identity(text)','60cb0cf2f919d738b46bde4fad4fcd61',true,'jsonb',true),
      ('public.lock_confirmed_profile_auth_identity(uuid,text)','a14ba875979007cb0a2d6f9cdda57b19',true,'uuid',true)
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
  FOR expected IN SELECT * FROM (VALUES
      ('guard_profile_identity_insert', 7), ('guard_profile_identity_update', 19)
    ) AS guards(name, kind)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger
        WHERE tgrelid = 'public.profiles'::regclass AND tgname = expected.name
          AND tgfoid = to_regprocedure('public.' || expected.name || '()')
          AND tgtype = expected.kind AND tgenabled IN ('O', 'A')
          AND NOT tgisinternal AND tgqual IS NULL AND tgnargs = 0 AND tgattr = ''::int2vector) THEN
      RAISE EXCEPTION 'IDENTITY_MIGRATION_REQUIRED: Core identity guard % must be enabled.', expected.name USING ERRCODE = '55000';
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.assert_profile_auth_identity_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_profile_auth_identity_v1() TO service_role;

$identity_ddl$;
  PERFORM public.assert_profile_auth_identity_v1();
  -- Retire the superseded Admin guard only after Core protection is proven.
  -- Core must also support scoped Orgs upgrades without advancing Admin SQL.
  DROP TRIGGER IF EXISTS guard_privileged_profile_fields ON public.profiles;
  DROP FUNCTION IF EXISTS public.guard_privileged_profile_fields();
END;
$identity_migration$;
