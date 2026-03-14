-- RBAC cleanup for single-row assignment model:
-- remove assignment-row lifecycle fields and align helper functions.

-- 1) Ensure no duplicate assignment rows remain.
WITH ranked AS (
  SELECT
    id,
    profile_id,
    row_number() OVER (
      PARTITION BY profile_id
      ORDER BY assigned_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.user_role_assignments
)
DELETE FROM public.user_role_assignments ura
USING ranked r
WHERE ura.id = r.id
  AND r.rn > 1;

-- 2) Replace any legacy index keyed by is_active.
DROP INDEX IF EXISTS public.idx_user_role_assignments_profile_active;
DROP INDEX IF EXISTS public.user_role_assignments_one_active_per_profile;

-- 3) Keep a single unique row per profile.
CREATE UNIQUE INDEX IF NOT EXISTS user_role_assignments_profile_unique
  ON public.user_role_assignments (profile_id);

-- 4) Drop now-redundant lifecycle columns.
ALTER TABLE public.user_role_assignments
  DROP COLUMN IF EXISTS is_active,
  DROP COLUMN IF EXISTS revoked_at;

-- 5) Recreate RBAC helper functions without is_active.
CREATE OR REPLACE FUNCTION public.current_global_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ura.role_code
  FROM public.user_role_assignments ura
  WHERE ura.profile_id = public.current_profile_id()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.has_role(target_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    WHERE ura.profile_id = public.current_profile_id()
      AND ura.role_code = target_role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_global_role() IN ('staff', 'admin'), false)
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_global_role() = 'admin', false)
$$;

-- 6) Keep role change function aligned to update-in-place model.
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
  LIMIT 1;

  IF v_old_role = p_new_role_code THEN
    RETURN QUERY SELECT false, 'already_role', v_old_role, p_new_role_code;
    RETURN;
  END IF;

  IF v_old_role = 'admin' AND p_new_role_code <> 'admin' THEN
    SELECT count(*)
    INTO v_admin_count
    FROM public.user_role_assignments ura
    WHERE ura.role_code = 'admin';

    IF v_admin_count <= 1 THEN
      RETURN QUERY SELECT false, 'last_admin_guard', v_old_role, p_new_role_code;
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.user_role_assignments (
    profile_id,
    role_code,
    assigned_by_profile_id,
    assigned_at,
    reason
  )
  VALUES (
    p_target_profile_id,
    p_new_role_code,
    v_actor_profile_id,
    now(),
    NULLIF(trim(COALESCE(p_reason, '')), '')
  )
  ON CONFLICT (profile_id)
  DO UPDATE
  SET role_code = EXCLUDED.role_code,
      assigned_by_profile_id = EXCLUDED.assigned_by_profile_id,
      assigned_at = EXCLUDED.assigned_at,
      reason = EXCLUDED.reason;

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
