-- Support authoritative organization search used by CRM and Projects pickers.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS organizations_name_trgm_idx
  ON public.organizations USING gin (name extensions.gin_trgm_ops);
