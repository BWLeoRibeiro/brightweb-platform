-- Brightweb admin v1 baseline.

CREATE TABLE IF NOT EXISTS public.roles (
  code text PRIMARY KEY,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view roles" ON public.roles;
CREATE POLICY "Authenticated users can view roles"
  ON public.roles
  FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO public.roles (code, label)
VALUES
  ('client', 'Client'),
  ('staff', 'Staff'),
  ('admin', 'Admin')
ON CONFLICT (code) DO UPDATE
SET label = EXCLUDED.label;

CREATE TABLE IF NOT EXISTS public.user_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_code text NOT NULL REFERENCES public.roles(code),
  assigned_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  reason text
);

CREATE INDEX IF NOT EXISTS idx_user_role_assignments_role_code
  ON public.user_role_assignments (role_code);

ALTER TABLE public.user_role_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own role assignments" ON public.user_role_assignments;
CREATE POLICY "Users can view own role assignments"
  ON public.user_role_assignments
  FOR SELECT
  TO authenticated
  USING (profile_id = public.current_profile_id());

DROP POLICY IF EXISTS "Staff can view role assignments" ON public.user_role_assignments;
CREATE POLICY "Staff can view role assignments"
  ON public.user_role_assignments
  FOR SELECT
  TO authenticated
  USING (public.is_staff());

CREATE TABLE IF NOT EXISTS public.role_change_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  changed_by_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  old_role_code text,
  new_role_code text NOT NULL REFERENCES public.roles(code),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_role_change_audit_target
  ON public.role_change_audit (target_profile_id, created_at DESC);

ALTER TABLE public.role_change_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view role change audit" ON public.role_change_audit;
CREATE POLICY "Admins can view role change audit"
  ON public.role_change_audit
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

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

CREATE OR REPLACE FUNCTION public.guard_privileged_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF public.is_staff() THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.email IS DISTINCT FROM OLD.email
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Staff cannot modify privileged profile fields'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_privileged_profile_fields ON public.profiles;
CREATE TRIGGER guard_privileged_profile_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.guard_privileged_profile_fields();

CREATE OR REPLACE FUNCTION public.ensure_profile_role_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_role_assignments (
    profile_id,
    role_code,
    assigned_at,
    assigned_by_profile_id,
    reason
  )
  VALUES (
    NEW.id,
    'client',
    now(),
    NULL,
    'auto_profile_default_client_role'
  )
  ON CONFLICT (profile_id)
  DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_profile_role_assignment ON public.profiles;
CREATE TRIGGER trg_ensure_profile_role_assignment
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.ensure_profile_role_assignment();

INSERT INTO public.user_role_assignments (
  profile_id,
  role_code,
  assigned_at,
  assigned_by_profile_id,
  reason
)
SELECT
  p.id,
  'client',
  now(),
  NULL,
  'auto_backfill_missing_profile_role'
FROM public.profiles p
LEFT JOIN public.user_role_assignments ura
  ON ura.profile_id = p.id
WHERE ura.profile_id IS NULL;
