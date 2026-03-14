ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS cancellation_reason text;
