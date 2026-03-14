-- Project lifecycle timestamps:
-- - keep created_at as project creation source of truth
-- - track first activation moment in activated_at
-- - auto-fill completed_at on first completion transition
-- - remove start_date (unused in product flow)

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS activated_at timestamptz;

ALTER TABLE public.projects
  DROP COLUMN IF EXISTS start_date;

CREATE OR REPLACE FUNCTION public.sync_project_lifecycle_dates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('active', 'completed') AND NEW.activated_at IS NULL THEN
      NEW.activated_at := now();
    END IF;

    IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.status = 'active'
    AND OLD.status IS DISTINCT FROM 'active'
    AND NEW.activated_at IS NULL THEN
    NEW.activated_at := now();
  END IF;

  IF NEW.status = 'completed'
    AND OLD.status IS DISTINCT FROM 'completed'
    AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projects_lifecycle_dates ON public.projects;
CREATE TRIGGER trg_projects_lifecycle_dates
BEFORE INSERT OR UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.sync_project_lifecycle_dates();
