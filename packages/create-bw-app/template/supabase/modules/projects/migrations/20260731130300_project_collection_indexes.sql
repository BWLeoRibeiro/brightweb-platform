-- Support project collection search, filters, and newest-first ordering.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS projects_name_trgm_idx
  ON public.projects USING gin (name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS projects_code_trgm_idx
  ON public.projects USING gin (code extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS projects_status_updated_idx
  ON public.projects (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS projects_health_updated_idx
  ON public.projects (health, updated_at DESC);
