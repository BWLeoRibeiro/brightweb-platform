-- RBAC backfill + mutation guards (big-bang cutover)

-- 1) Backfill active global role assignments from profiles.user_type
INSERT INTO public.user_role_assignments (
  profile_id,
  role_code,
  is_active,
  assigned_at,
  reason
)
SELECT
  p.id,
  CASE lower(COALESCE(trim(p.user_type), ''))
    WHEN 'admin' THEN 'admin'
    WHEN 'staff' THEN 'staff'
    ELSE 'client'
  END AS role_code,
  true,
  now(),
  'rbac_big_bang_backfill'
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_role_assignments ura
  WHERE ura.profile_id = p.id
    AND ura.is_active = true
);

-- Enforce single active role per profile
CREATE UNIQUE INDEX IF NOT EXISTS user_role_assignments_one_active_per_profile
  ON public.user_role_assignments (profile_id)
  WHERE is_active = true;

-- Ensure at least one active admin exists
DO $$
DECLARE
  v_admin_count integer;
  v_legacy_admin_count integer;
BEGIN
  SELECT count(*) INTO v_admin_count
  FROM public.user_role_assignments
  WHERE is_active = true
    AND role_code = 'admin';

  SELECT count(*) INTO v_legacy_admin_count
  FROM public.profiles
  WHERE lower(COALESCE(trim(user_type), '')) = 'admin';

  IF v_admin_count = 0 AND v_legacy_admin_count > 0 THEN
    RAISE EXCEPTION 'RBAC backfill failed: no active admin role found';
  END IF;
END;
$$;

-- 2) Controlled role mutation function
CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  p_target_profile_id uuid,
  p_new_role_code text,
  p_reason text DEFAULT NULL
)
RETURNS TABLE (
  changed boolean,
  reason text,
  old_role_code text,
  new_role_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_profile_id uuid;
  v_target_exists boolean;
  v_old_role text;
  v_admin_count integer;
BEGIN
  v_actor_profile_id := public.current_profile_id();

  IF v_actor_profile_id IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can change roles'
      USING ERRCODE = '42501';
  END IF;

  IF p_new_role_code IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.roles r WHERE r.code = p_new_role_code
  ) THEN
    RAISE EXCEPTION 'Invalid role code: %', p_new_role_code
      USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = p_target_profile_id
  ) INTO v_target_exists;

  IF NOT v_target_exists THEN
    RETURN QUERY SELECT false, 'not_found', NULL::text, p_new_role_code;
    RETURN;
  END IF;

  SELECT ura.role_code
  INTO v_old_role
  FROM public.user_role_assignments ura
  WHERE ura.profile_id = p_target_profile_id
    AND ura.is_active = true
  ORDER BY ura.assigned_at DESC
  LIMIT 1;

  IF v_old_role = p_new_role_code THEN
    RETURN QUERY SELECT false, 'already_role', v_old_role, p_new_role_code;
    RETURN;
  END IF;

  IF v_old_role = 'admin' AND p_new_role_code <> 'admin' THEN
    SELECT count(*)
    INTO v_admin_count
    FROM public.user_role_assignments ura
    WHERE ura.is_active = true
      AND ura.role_code = 'admin';

    IF v_admin_count <= 1 THEN
      RETURN QUERY SELECT false, 'last_admin_guard', v_old_role, p_new_role_code;
      RETURN;
    END IF;
  END IF;

  UPDATE public.user_role_assignments
  SET is_active = false,
      revoked_at = now()
  WHERE profile_id = p_target_profile_id
    AND is_active = true;

  INSERT INTO public.user_role_assignments (
    profile_id,
    role_code,
    is_active,
    assigned_by_profile_id,
    assigned_at,
    reason
  ) VALUES (
    p_target_profile_id,
    p_new_role_code,
    true,
    v_actor_profile_id,
    now(),
    NULLIF(trim(COALESCE(p_reason, '')), '')
  );

  INSERT INTO public.role_change_audit (
    target_profile_id,
    changed_by_profile_id,
    old_role_code,
    new_role_code,
    reason,
    created_at
  ) VALUES (
    p_target_profile_id,
    v_actor_profile_id,
    v_old_role,
    p_new_role_code,
    NULLIF(trim(COALESCE(p_reason, '')), ''),
    now()
  );

  RETURN QUERY SELECT true, 'changed', v_old_role, p_new_role_code;
END;
$$;
