ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS start_date date;

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_date_range_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_date_range_check
  CHECK (start_date IS NULL OR target_date IS NULL OR target_date >= start_date);

CREATE INDEX IF NOT EXISTS idx_projects_start_date
  ON public.projects(start_date);
