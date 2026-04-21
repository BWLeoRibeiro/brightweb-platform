-- portal_read_indexes
-- target: projects
-- created_at: 2026-04-21T20:15:28.609Z

CREATE INDEX IF NOT EXISTS idx_project_tasks_status
  ON public.project_tasks (status);
