-- Narrow client-owned organization memberships for account surfaces.

CREATE OR REPLACE FUNCTION public.list_current_client_organizations()
RETURNS TABLE (
  organization_id uuid,
  organization_name text,
  membership_role text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    organization.id,
    organization.name,
    membership.role
  FROM public.organization_members membership
  JOIN public.organizations organization
    ON organization.id = membership.organization_id
  WHERE public.current_global_role() = 'client'
    AND membership.profile_id = public.current_profile_id()
  ORDER BY organization.name, organization.id
$$;

REVOKE ALL ON FUNCTION public.list_current_client_organizations()
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.list_current_client_organizations()
  TO authenticated;
