-- Profile synchronization is an internal auth bridge, not a caller-supplied identity API.
-- Auth triggers execute as their owner; server registration uses service_role.
REVOKE ALL ON FUNCTION public.sync_profile_from_auth_identity(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_profile_from_auth_identity(uuid, text, jsonb) TO service_role;
