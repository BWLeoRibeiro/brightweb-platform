ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS start_date date;

ALTER TABLE public.project_tasks
  DROP CONSTRAINT IF EXISTS project_tasks_date_range_check;

ALTER TABLE public.project_tasks
  ADD CONSTRAINT project_tasks_date_range_check
  CHECK (start_date IS NULL OR due_date IS NULL OR due_date >= start_date);

CREATE INDEX IF NOT EXISTS idx_project_tasks_start_date
  ON public.project_tasks (start_date);
