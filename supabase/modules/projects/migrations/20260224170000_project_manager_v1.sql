-- Project Manager v1 foundation

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  name text NOT NULL,
  code text,
  status text NOT NULL DEFAULT 'planned',
  health text NOT NULL DEFAULT 'on_track',
  owner_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  start_date date,
  target_date date,
  completed_at timestamptz,
  summary text,
  enabled_modules text[] NOT NULL DEFAULT ARRAY[
    'project-core',
    'task-execution',
    'milestones',
    'client-portal-readonly',
    'project-links',
    'activity-feed'
  ]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projects_status_check CHECK (status IN ('planned', 'active', 'blocked', 'completed', 'canceled')),
  CONSTRAINT projects_health_check CHECK (health IN ('on_track', 'at_risk', 'off_track')),
  CONSTRAINT projects_name_check CHECK (length(btrim(name)) > 0),
  CONSTRAINT projects_code_check CHECK (code IS NULL OR length(btrim(code)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_code_unique
  ON public.projects ((lower(code)))
  WHERE code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_org ON public.projects (organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON public.projects (owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects (status);
CREATE INDEX IF NOT EXISTS idx_projects_health ON public.projects (health);
CREATE INDEX IF NOT EXISTS idx_projects_target_date ON public.projects (target_date);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at_desc ON public.projects (updated_at DESC);

CREATE TABLE IF NOT EXISTS public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'contributor',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_members_role_check CHECK (role IN ('owner', 'contributor', 'observer')),
  CONSTRAINT project_members_unique UNIQUE (project_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project ON public.project_members (project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_profile ON public.project_members (profile_id);

CREATE TABLE IF NOT EXISTS public.project_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  target_date date,
  completed_at timestamptz,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_milestones_status_check CHECK (status IN ('pending', 'in_progress', 'achieved', 'delayed')),
  CONSTRAINT project_milestones_title_check CHECK (length(btrim(title)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_project_milestones_project ON public.project_milestones (project_id);
CREATE INDEX IF NOT EXISTS idx_project_milestones_position ON public.project_milestones (project_id, position);
CREATE INDEX IF NOT EXISTS idx_project_milestones_target_date ON public.project_milestones (target_date);

CREATE TABLE IF NOT EXISTS public.project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES public.project_milestones(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo',
  priority text NOT NULL DEFAULT 'medium',
  assignee_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reporter_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date date,
  position integer NOT NULL DEFAULT 0,
  blocked_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_tasks_status_check CHECK (status IN ('todo', 'in_progress', 'blocked', 'done')),
  CONSTRAINT project_tasks_priority_check CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  CONSTRAINT project_tasks_title_check CHECK (length(btrim(title)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON public.project_tasks (project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_project_status ON public.project_tasks (project_id, status);
CREATE INDEX IF NOT EXISTS idx_project_tasks_project_position ON public.project_tasks (project_id, position);
CREATE INDEX IF NOT EXISTS idx_project_tasks_due_date ON public.project_tasks (due_date);
CREATE INDEX IF NOT EXISTS idx_project_tasks_assignee ON public.project_tasks (assignee_profile_id);

CREATE TABLE IF NOT EXISTS public.project_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  label text NOT NULL,
  url text NOT NULL,
  visibility text NOT NULL DEFAULT 'staff',
  kind text NOT NULL DEFAULT 'other',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_links_visibility_check CHECK (visibility IN ('staff', 'client')),
  CONSTRAINT project_links_kind_check CHECK (kind IN ('doc', 'sheet', 'drive', 'other')),
  CONSTRAINT project_links_label_check CHECK (length(btrim(label)) > 0),
  CONSTRAINT project_links_url_check CHECK (url ~* '^https?://')
);

CREATE INDEX IF NOT EXISTS idx_project_links_project ON public.project_links (project_id);
CREATE INDEX IF NOT EXISTS idx_project_links_visibility ON public.project_links (visibility);

CREATE TABLE IF NOT EXISTS public.project_status_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  reason text,
  changed_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_status_log_new_status_check CHECK (new_status IN ('planned', 'active', 'blocked', 'completed', 'canceled'))
);

CREATE INDEX IF NOT EXISTS idx_project_status_log_project_changed_at_desc
  ON public.project_status_log (project_id, changed_at DESC);

CREATE OR REPLACE FUNCTION public.set_project_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projects_updated_at ON public.projects;
CREATE TRIGGER trg_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.set_project_updated_at();

DROP TRIGGER IF EXISTS trg_project_milestones_updated_at ON public.project_milestones;
CREATE TRIGGER trg_project_milestones_updated_at
BEFORE UPDATE ON public.project_milestones
FOR EACH ROW
EXECUTE FUNCTION public.set_project_updated_at();

DROP TRIGGER IF EXISTS trg_project_tasks_updated_at ON public.project_tasks;
CREATE TRIGGER trg_project_tasks_updated_at
BEFORE UPDATE ON public.project_tasks
FOR EACH ROW
EXECUTE FUNCTION public.set_project_updated_at();

DROP TRIGGER IF EXISTS trg_project_links_updated_at ON public.project_links;
CREATE TRIGGER trg_project_links_updated_at
BEFORE UPDATE ON public.project_links
FOR EACH ROW
EXECUTE FUNCTION public.set_project_updated_at();

CREATE OR REPLACE FUNCTION public.is_project_org_admin(target_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = target_project_id
      AND public.is_org_admin(p.organization_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_project_org_member(target_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = target_project_id
      AND public.is_org_member(p.organization_id)
  )
$$;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_status_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage projects" ON public.projects;
DROP POLICY IF EXISTS "Org admins view projects" ON public.projects;
CREATE POLICY "Staff manage projects"
  ON public.projects
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "Org admins view projects"
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "Staff manage project members" ON public.project_members;
DROP POLICY IF EXISTS "Org admins view project members" ON public.project_members;
CREATE POLICY "Staff manage project members"
  ON public.project_members
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "Org admins view project members"
  ON public.project_members
  FOR SELECT
  TO authenticated
  USING (public.is_project_org_admin(project_id));

DROP POLICY IF EXISTS "Staff manage project milestones" ON public.project_milestones;
DROP POLICY IF EXISTS "Org admins view project milestones" ON public.project_milestones;
CREATE POLICY "Staff manage project milestones"
  ON public.project_milestones
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "Org admins view project milestones"
  ON public.project_milestones
  FOR SELECT
  TO authenticated
  USING (public.is_project_org_admin(project_id));

DROP POLICY IF EXISTS "Staff manage project tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Org admins view project tasks" ON public.project_tasks;
CREATE POLICY "Staff manage project tasks"
  ON public.project_tasks
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "Org admins view project tasks"
  ON public.project_tasks
  FOR SELECT
  TO authenticated
  USING (public.is_project_org_admin(project_id));

DROP POLICY IF EXISTS "Staff manage project links" ON public.project_links;
DROP POLICY IF EXISTS "Org admins view client project links" ON public.project_links;
CREATE POLICY "Staff manage project links"
  ON public.project_links
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

CREATE POLICY "Org admins view client project links"
  ON public.project_links
  FOR SELECT
  TO authenticated
  USING (visibility = 'client' AND public.is_project_org_admin(project_id));

DROP POLICY IF EXISTS "Staff view project status log" ON public.project_status_log;
DROP POLICY IF EXISTS "Org admins view project status log" ON public.project_status_log;
CREATE POLICY "Staff view project status log"
  ON public.project_status_log
  FOR SELECT
  TO authenticated
  USING (public.is_staff());

CREATE POLICY "Org admins view project status log"
  ON public.project_status_log
  FOR SELECT
  TO authenticated
  USING (public.is_project_org_admin(project_id));

CREATE OR REPLACE FUNCTION public.log_projects_activity_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_summary text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_app_activity_event(
      'projects',
      'project_created',
      'projects',
      NEW.id,
      'Projeto criado: ' || COALESCE(NULLIF(btrim(NEW.name), ''), 'Sem nome'),
      jsonb_build_object(
        'project_id', NEW.id,
        'organization_id', NEW.organization_id,
        'status', NEW.status,
        'health', NEW.health
      )
    );

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.project_status_log (
        project_id,
        previous_status,
        new_status,
        reason,
        changed_by_profile_id
      ) VALUES (
        NEW.id,
        OLD.status,
        NEW.status,
        NULL,
        public.current_profile_id()
      );
    END IF;

    IF NEW.name IS DISTINCT FROM OLD.name
      OR NEW.summary IS DISTINCT FROM OLD.summary
      OR NEW.target_date IS DISTINCT FROM OLD.target_date
      OR NEW.health IS DISTINCT FROM OLD.health
      OR NEW.owner_profile_id IS DISTINCT FROM OLD.owner_profile_id
      OR NEW.status IS DISTINCT FROM OLD.status THEN
      v_summary := 'Projeto atualizado: ' || COALESCE(NULLIF(btrim(NEW.name), ''), 'Sem nome');

      PERFORM public.log_app_activity_event(
        'projects',
        CASE WHEN NEW.status IS DISTINCT FROM OLD.status THEN 'project_status_changed' ELSE 'project_updated' END,
        'projects',
        NEW.id,
        v_summary,
        jsonb_build_object(
          'project_id', NEW.id,
          'previous_status', OLD.status,
          'new_status', NEW.status,
          'previous_health', OLD.health,
          'new_health', NEW.health
        )
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_projects_activity_event ON public.projects;
CREATE TRIGGER trg_log_projects_activity_event
AFTER INSERT OR UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.log_projects_activity_event();

CREATE OR REPLACE FUNCTION public.log_project_tasks_activity_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_app_activity_event(
      'projects',
      'task_created',
      'project_tasks',
      NEW.id,
      'Tarefa criada: ' || COALESCE(NULLIF(btrim(NEW.title), ''), 'Sem título'),
      jsonb_build_object(
        'task_id', NEW.id,
        'project_id', NEW.project_id,
        'status', NEW.status,
        'priority', NEW.priority
      )
    );

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    PERFORM public.log_app_activity_event(
      'projects',
      CASE WHEN NEW.status IS DISTINCT FROM OLD.status THEN 'task_status_changed' ELSE 'task_updated' END,
      'project_tasks',
      NEW.id,
      CASE
        WHEN NEW.status IS DISTINCT FROM OLD.status
          THEN 'Estado da tarefa alterado: ' || COALESCE(NULLIF(btrim(NEW.title), ''), 'Sem título')
        ELSE 'Tarefa atualizada: ' || COALESCE(NULLIF(btrim(NEW.title), ''), 'Sem título')
      END,
      jsonb_build_object(
        'task_id', NEW.id,
        'project_id', NEW.project_id,
        'previous_status', OLD.status,
        'new_status', NEW.status,
        'priority', NEW.priority
      )
    );

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_project_tasks_activity_event ON public.project_tasks;
CREATE TRIGGER trg_log_project_tasks_activity_event
AFTER INSERT OR UPDATE ON public.project_tasks
FOR EACH ROW
EXECUTE FUNCTION public.log_project_tasks_activity_event();

CREATE OR REPLACE FUNCTION public.log_project_milestones_activity_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.log_app_activity_event(
      'projects',
      'milestone_status_changed',
      'project_milestones',
      NEW.id,
      'Marco atualizado: ' || COALESCE(NULLIF(btrim(NEW.title), ''), 'Sem título') || ' (' || NEW.status || ')',
      jsonb_build_object(
        'milestone_id', NEW.id,
        'project_id', NEW.project_id,
        'previous_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_project_milestones_activity_event ON public.project_milestones;
CREATE TRIGGER trg_log_project_milestones_activity_event
AFTER UPDATE ON public.project_milestones
FOR EACH ROW
EXECUTE FUNCTION public.log_project_milestones_activity_event();
