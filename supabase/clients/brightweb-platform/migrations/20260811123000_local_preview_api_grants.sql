-- Local Platform Preview runs against a fresh Supabase CLI database. Grant the
-- DML privileges expected by the module RLS policies without granting TRUNCATE
-- or bypassing row-level security. This client-only migration is not shipped to
-- BeGreen, MQ, or other generated applications.

GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public
  TO authenticated, service_role;

GRANT USAGE, SELECT
  ON ALL SEQUENCES IN SCHEMA public
  TO authenticated, service_role;
