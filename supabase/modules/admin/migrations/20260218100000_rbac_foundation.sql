-- RBAC foundation (big-bang cutover)

-- 1) Role catalog
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

-- 2) Global role assignments (one active role per profile)
CREATE TABLE IF NOT EXISTS public.user_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_code text NOT NULL REFERENCES public.roles(code),
  is_active boolean NOT NULL DEFAULT true,
  assigned_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  reason text
);

CREATE INDEX IF NOT EXISTS idx_user_role_assignments_profile_active
  ON public.user_role_assignments (profile_id, is_active);

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

-- 3) Role change audit log
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

-- 4) RBAC helper functions
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
    AND ura.is_active = true
  ORDER BY ura.assigned_at DESC
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
      AND ura.is_active = true
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

DROP POLICY IF EXISTS "Admins can view role change audit" ON public.role_change_audit;
CREATE POLICY "Admins can view role change audit"
  ON public.role_change_audit
  FOR SELECT
  TO authenticated
  USING (public.is_admin());
