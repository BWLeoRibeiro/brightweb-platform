-- The admin directory joins role assignments to profiles using the caller's
-- authenticated session. Grant the corresponding profile reads through RLS.
-- Staff and clients retain their existing profile visibility and write rules.
DROP POLICY IF EXISTS "Admins can view profiles" ON public.profiles;
CREATE POLICY "Admins can view profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin());
