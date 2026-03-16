-- Brightweb projects v1 baseline.

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  name text NOT NULL,
  code text,
  status text NOT NULL DEFAULT 'planned',
  health text NOT NULL DEFAULT 'on_track',
  owner_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  activated_at timestamptz,
  target_date date,
  completed_at timestamptz,
  cancellation_reason text,
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

CREATE INDEX IF NOT EXISTS idx_projects_org
  ON public.projects (organization_id);

CREATE INDEX IF NOT EXISTS idx_projects_owner
  ON public.projects (owner_profile_id);

CREATE INDEX IF NOT EXISTS idx_projects_status
  ON public.projects (status);

CREATE INDEX IF NOT EXISTS idx_projects_health
  ON public.projects (health);

CREATE INDEX IF NOT EXISTS idx_projects_target_date
  ON public.projects (target_date);

CREATE INDEX IF NOT EXISTS idx_projects_updated_at_desc
  ON public.projects (updated_at DESC);

CREATE TABLE IF NOT EXISTS public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'contributor',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_members_role_check CHECK (role IN ('owner', 'contributor', 'observer')),
  CONSTRAINT project_members_unique UNIQUE (project_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project
  ON public.project_members (project_id);

CREATE INDEX IF NOT EXISTS idx_project_members_profile
  ON public.project_members (profile_id);

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

CREATE INDEX IF NOT EXISTS idx_project_milestones_project
  ON public.project_milestones (project_id);

CREATE INDEX IF NOT EXISTS idx_project_milestones_position
  ON public.project_milestones (project_id, position);

CREATE INDEX IF NOT EXISTS idx_project_milestones_target_date
  ON public.project_milestones (target_date);

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

CREATE INDEX IF NOT EXISTS idx_project_tasks_project
  ON public.project_tasks (project_id);

CREATE INDEX IF NOT EXISTS idx_project_tasks_project_status
  ON public.project_tasks (project_id, status);

CREATE INDEX IF NOT EXISTS idx_project_tasks_project_position
  ON public.project_tasks (project_id, position);

CREATE INDEX IF NOT EXISTS idx_project_tasks_due_date
  ON public.project_tasks (due_date);

CREATE INDEX IF NOT EXISTS idx_project_tasks_assignee
  ON public.project_tasks (assignee_profile_id);

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

CREATE INDEX IF NOT EXISTS idx_project_links_project
  ON public.project_links (project_id);

CREATE INDEX IF NOT EXISTS idx_project_links_visibility
  ON public.project_links (visibility);

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

CREATE OR REPLACE FUNCTION public.can_create_projects_for_org(target_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_org_admin(target_org_id)
$$;

CREATE OR REPLACE FUNCTION public.is_project_team_member(target_project_id uuid)
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
      AND (
        p.owner_profile_id = public.current_profile_id()
        OR EXISTS (
          SELECT 1
          FROM public.project_members pm
          WHERE pm.project_id = p.id
            AND pm.profile_id = public.current_profile_id()
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.is_project_content_editor(target_project_id uuid)
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
      AND (
        p.owner_profile_id = public.current_profile_id()
        OR EXISTS (
          SELECT 1
          FROM public.project_members pm
          WHERE pm.project_id = p.id
            AND pm.profile_id = public.current_profile_id()
            AND pm.role IN ('owner', 'contributor')
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.is_project_owner_member(target_project_id uuid)
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
      AND (
        p.owner_profile_id = public.current_profile_id()
        OR EXISTS (
          SELECT 1
          FROM public.project_members pm
          WHERE pm.project_id = p.id
            AND pm.profile_id = public.current_profile_id()
            AND pm.role = 'owner'
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.project_activity_project_name(
  p_project_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.name
  FROM public.projects p
  WHERE p.id = p_project_id;
$$;

CREATE OR REPLACE FUNCTION public.log_project_activity_event(
  p_event_type text,
  p_entity_table text,
  p_entity_id uuid,
  p_project_id uuid,
  p_summary text,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_actor_profile_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload jsonb := COALESCE(p_payload, '{}'::jsonb);
  v_project_name text;
BEGIN
  IF p_project_id IS NOT NULL THEN
    IF NOT (v_payload ? 'project_id') THEN
      v_payload := v_payload || jsonb_build_object('project_id', p_project_id);
    END IF;

    IF NOT (v_payload ? 'project_name') THEN
      v_project_name := public.project_activity_project_name(p_project_id);
      IF v_project_name IS NOT NULL THEN
        v_payload := v_payload || jsonb_build_object('project_name', v_project_name);
      END IF;
    END IF;
  END IF;

  PERFORM public.log_app_activity_event(
    'projects',
    p_event_type,
    p_entity_table,
    p_entity_id,
    p_summary,
    v_payload,
    p_actor_profile_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_project_activity_event(text, text, uuid, uuid, text, jsonb, uuid)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_project_activity_event(text, text, uuid, uuid, text, jsonb, uuid)
  FROM anon;
REVOKE ALL ON FUNCTION public.log_project_activity_event(text, text, uuid, uuid, text, jsonb, uuid)
  FROM authenticated;
GRANT EXECUTE ON FUNCTION public.log_project_activity_event(text, text, uuid, uuid, text, jsonb, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.log_projects_activity_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_summary text;
  v_changes jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_project_activity_event(
      'project_created',
      'projects',
      NEW.id,
      NEW.id,
      'Projeto criado: ' || COALESCE(NULLIF(btrim(NEW.name), ''), 'Sem nome'),
      jsonb_build_object(
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

    IF NEW.name IS DISTINCT FROM OLD.name THEN
      v_changes := v_changes || jsonb_build_object('name', jsonb_build_object('from', OLD.name, 'to', NEW.name));
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_changes := v_changes || jsonb_build_object('status', jsonb_build_object('from', OLD.status, 'to', NEW.status));
    END IF;

    IF NEW.target_date IS DISTINCT FROM OLD.target_date THEN
      v_changes := v_changes || jsonb_build_object('target_date', jsonb_build_object('from', OLD.target_date, 'to', NEW.target_date));
    END IF;

    IF NEW.owner_profile_id IS DISTINCT FROM OLD.owner_profile_id THEN
      v_changes := v_changes || jsonb_build_object(
        'owner_profile_id',
        jsonb_build_object('from', OLD.owner_profile_id, 'to', NEW.owner_profile_id)
      );
    END IF;

    IF NEW.summary IS DISTINCT FROM OLD.summary THEN
      v_changes := v_changes || jsonb_build_object('summary', jsonb_build_object('from', OLD.summary, 'to', NEW.summary));
    END IF;

    IF NEW.name IS DISTINCT FROM OLD.name
      OR NEW.summary IS DISTINCT FROM OLD.summary
      OR NEW.target_date IS DISTINCT FROM OLD.target_date
      OR NEW.health IS DISTINCT FROM OLD.health
      OR NEW.owner_profile_id IS DISTINCT FROM OLD.owner_profile_id
      OR NEW.status IS DISTINCT FROM OLD.status THEN
      v_summary := 'Projeto atualizado: ' || COALESCE(NULLIF(btrim(NEW.name), ''), 'Sem nome');

      PERFORM public.log_project_activity_event(
        CASE WHEN NEW.status IS DISTINCT FROM OLD.status THEN 'project_status_changed' ELSE 'project_updated' END,
        'projects',
        NEW.id,
        NEW.id,
        v_summary,
        jsonb_strip_nulls(
          jsonb_build_object(
            'previous_status', OLD.status,
            'new_status', NEW.status,
            'previous_health', OLD.health,
            'new_health', NEW.health,
            'changes', CASE WHEN v_changes = '{}'::jsonb THEN NULL ELSE v_changes END
          )
        )
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_project_tasks_activity_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changes jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_project_activity_event(
      'task_created',
      'project_tasks',
      NEW.id,
      NEW.project_id,
      'Tarefa criada: ' || COALESCE(NULLIF(btrim(NEW.title), ''), 'Sem título'),
      jsonb_build_object(
        'task_id', NEW.id,
        'status', NEW.status,
        'priority', NEW.priority,
        'assignee_profile_id', NEW.assignee_profile_id,
        'due_date', NEW.due_date
      )
    );

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.title IS DISTINCT FROM OLD.title THEN
      v_changes := v_changes || jsonb_build_object('title', jsonb_build_object('from', OLD.title, 'to', NEW.title));
    END IF;

    IF NEW.description IS DISTINCT FROM OLD.description THEN
      v_changes := v_changes || jsonb_build_object('description', jsonb_build_object('from', OLD.description, 'to', NEW.description));
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_changes := v_changes || jsonb_build_object('status', jsonb_build_object('from', OLD.status, 'to', NEW.status));
    END IF;

    IF NEW.priority IS DISTINCT FROM OLD.priority THEN
      v_changes := v_changes || jsonb_build_object('priority', jsonb_build_object('from', OLD.priority, 'to', NEW.priority));
    END IF;

    IF NEW.due_date IS DISTINCT FROM OLD.due_date THEN
      v_changes := v_changes || jsonb_build_object('due_date', jsonb_build_object('from', OLD.due_date, 'to', NEW.due_date));
    END IF;

    IF NEW.assignee_profile_id IS DISTINCT FROM OLD.assignee_profile_id THEN
      v_changes := v_changes || jsonb_build_object(
        'assignee_profile_id',
        jsonb_build_object('from', OLD.assignee_profile_id, 'to', NEW.assignee_profile_id)
      );
    END IF;

    IF NEW.milestone_id IS DISTINCT FROM OLD.milestone_id THEN
      v_changes := v_changes || jsonb_build_object('milestone_id', jsonb_build_object('from', OLD.milestone_id, 'to', NEW.milestone_id));
    END IF;

    IF NEW.blocked_reason IS DISTINCT FROM OLD.blocked_reason THEN
      v_changes := v_changes || jsonb_build_object('blocked_reason', jsonb_build_object('from', OLD.blocked_reason, 'to', NEW.blocked_reason));
    END IF;

    IF v_changes <> '{}'::jsonb THEN
      PERFORM public.log_project_activity_event(
        CASE WHEN NEW.status IS DISTINCT FROM OLD.status THEN 'task_status_changed' ELSE 'task_updated' END,
        'project_tasks',
        NEW.id,
        NEW.project_id,
        CASE
          WHEN NEW.status IS DISTINCT FROM OLD.status
            THEN 'Estado da tarefa alterado: ' || COALESCE(NULLIF(btrim(NEW.title), ''), 'Sem título')
          ELSE 'Tarefa atualizada: ' || COALESCE(NULLIF(btrim(NEW.title), ''), 'Sem título')
        END,
        jsonb_build_object(
          'task_id', NEW.id,
          'previous_status', OLD.status,
          'new_status', NEW.status,
          'changes', v_changes
        )
      );
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.log_project_activity_event(
      'task_deleted',
      'project_tasks',
      OLD.id,
      OLD.project_id,
      'Tarefa eliminada: ' || COALESCE(NULLIF(btrim(OLD.title), ''), 'Sem título'),
      jsonb_build_object(
        'task_id', OLD.id,
        'status', OLD.status,
        'priority', OLD.priority,
        'assignee_profile_id', OLD.assignee_profile_id,
        'due_date', OLD.due_date
      )
    );

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_project_milestones_activity_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changes jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_project_activity_event(
      'milestone_created',
      'project_milestones',
      NEW.id,
      NEW.project_id,
      'Milestone criada: ' || COALESCE(NULLIF(btrim(NEW.title), ''), 'Sem título'),
      jsonb_build_object(
        'milestone_id', NEW.id,
        'status', NEW.status,
        'target_date', NEW.target_date
      )
    );

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.title IS DISTINCT FROM OLD.title THEN
      v_changes := v_changes || jsonb_build_object('title', jsonb_build_object('from', OLD.title, 'to', NEW.title));
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_changes := v_changes || jsonb_build_object('status', jsonb_build_object('from', OLD.status, 'to', NEW.status));
    END IF;

    IF NEW.target_date IS DISTINCT FROM OLD.target_date THEN
      v_changes := v_changes || jsonb_build_object('target_date', jsonb_build_object('from', OLD.target_date, 'to', NEW.target_date));
    END IF;

    IF NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
      v_changes := v_changes || jsonb_build_object('completed_at', jsonb_build_object('from', OLD.completed_at, 'to', NEW.completed_at));
    END IF;

    IF v_changes <> '{}'::jsonb THEN
      PERFORM public.log_project_activity_event(
        CASE WHEN NEW.status IS DISTINCT FROM OLD.status THEN 'milestone_status_changed' ELSE 'milestone_updated' END,
        'project_milestones',
        NEW.id,
        NEW.project_id,
        CASE
          WHEN NEW.status IS DISTINCT FROM OLD.status
            THEN 'Estado da milestone alterado: ' || COALESCE(NULLIF(btrim(NEW.title), ''), 'Sem título')
          ELSE 'Milestone atualizada: ' || COALESCE(NULLIF(btrim(NEW.title), ''), 'Sem título')
        END,
        jsonb_build_object(
          'milestone_id', NEW.id,
          'previous_status', OLD.status,
          'new_status', NEW.status,
          'changes', v_changes
        )
      );
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.log_project_activity_event(
      'milestone_deleted',
      'project_milestones',
      OLD.id,
      OLD.project_id,
      'Milestone eliminada: ' || COALESCE(NULLIF(btrim(OLD.title), ''), 'Sem título'),
      jsonb_build_object(
        'milestone_id', OLD.id,
        'status', OLD.status,
        'target_date', OLD.target_date
      )
    );

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_project_links_activity_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changes jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_project_activity_event(
      'link_created',
      'project_links',
      NEW.id,
      NEW.project_id,
      'Link criado: ' || COALESCE(NULLIF(btrim(NEW.label), ''), 'Sem rótulo'),
      jsonb_build_object(
        'link_id', NEW.id,
        'kind', NEW.kind,
        'visibility', NEW.visibility
      )
    );

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.label IS DISTINCT FROM OLD.label THEN
      v_changes := v_changes || jsonb_build_object('label', jsonb_build_object('from', OLD.label, 'to', NEW.label));
    END IF;

    IF NEW.url IS DISTINCT FROM OLD.url THEN
      v_changes := v_changes || jsonb_build_object('url', jsonb_build_object('from', OLD.url, 'to', NEW.url));
    END IF;

    IF NEW.kind IS DISTINCT FROM OLD.kind THEN
      v_changes := v_changes || jsonb_build_object('kind', jsonb_build_object('from', OLD.kind, 'to', NEW.kind));
    END IF;

    IF NEW.visibility IS DISTINCT FROM OLD.visibility THEN
      v_changes := v_changes || jsonb_build_object('visibility', jsonb_build_object('from', OLD.visibility, 'to', NEW.visibility));
    END IF;

    IF v_changes <> '{}'::jsonb THEN
      PERFORM public.log_project_activity_event(
        'link_updated',
        'project_links',
        NEW.id,
        NEW.project_id,
        'Link atualizado: ' || COALESCE(NULLIF(btrim(NEW.label), ''), 'Sem rótulo'),
        jsonb_build_object(
          'link_id', NEW.id,
          'changes', v_changes
        )
      );
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.log_project_activity_event(
      'link_deleted',
      'project_links',
      OLD.id,
      OLD.project_id,
      'Link eliminado: ' || COALESCE(NULLIF(btrim(OLD.label), ''), 'Sem rótulo'),
      jsonb_build_object(
        'link_id', OLD.id,
        'kind', OLD.kind,
        'visibility', OLD.visibility
      )
    );

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_project_members_activity_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_project_activity_event(
      'member_added',
      'project_members',
      NEW.id,
      NEW.project_id,
      'Membro adicionado à equipa do projeto',
      jsonb_build_object(
        'member_id', NEW.id,
        'profile_id', NEW.profile_id,
        'role', NEW.role
      )
    );

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      PERFORM public.log_project_activity_event(
        'member_role_changed',
        'project_members',
        NEW.id,
        NEW.project_id,
        'Função de membro atualizada na equipa do projeto',
        jsonb_build_object(
          'member_id', NEW.id,
          'profile_id', NEW.profile_id,
          'previous_role', OLD.role,
          'new_role', NEW.role,
          'changes', jsonb_build_object(
            'role', jsonb_build_object('from', OLD.role, 'to', NEW.role)
          )
        )
      );
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.log_project_activity_event(
      'member_removed',
      'project_members',
      OLD.id,
      OLD.project_id,
      'Membro removido da equipa do projeto',
      jsonb_build_object(
        'member_id', OLD.id,
        'profile_id', OLD.profile_id,
        'role', OLD.role
      )
    );

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_projects_activity_event ON public.projects;
CREATE TRIGGER trg_log_projects_activity_event
AFTER INSERT OR UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.log_projects_activity_event();

DROP TRIGGER IF EXISTS trg_log_project_tasks_activity_event ON public.project_tasks;
CREATE TRIGGER trg_log_project_tasks_activity_event
AFTER INSERT OR UPDATE OR DELETE ON public.project_tasks
FOR EACH ROW
EXECUTE FUNCTION public.log_project_tasks_activity_event();

DROP TRIGGER IF EXISTS trg_log_project_milestones_activity_event ON public.project_milestones;
CREATE TRIGGER trg_log_project_milestones_activity_event
AFTER INSERT OR UPDATE OR DELETE ON public.project_milestones
FOR EACH ROW
EXECUTE FUNCTION public.log_project_milestones_activity_event();

DROP TRIGGER IF EXISTS trg_log_project_links_activity_event ON public.project_links;
CREATE TRIGGER trg_log_project_links_activity_event
AFTER INSERT OR UPDATE OR DELETE ON public.project_links
FOR EACH ROW
EXECUTE FUNCTION public.log_project_links_activity_event();

DROP TRIGGER IF EXISTS trg_log_project_members_activity_event ON public.project_members;
CREATE TRIGGER trg_log_project_members_activity_event
AFTER INSERT OR UPDATE OR DELETE ON public.project_members
FOR EACH ROW
EXECUTE FUNCTION public.log_project_members_activity_event();

CREATE OR REPLACE FUNCTION public.sync_org_primary_contact_admin_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.primary_contact_id IS DISTINCT FROM NEW.primary_contact_id THEN
    IF OLD.primary_contact_id IS NOT NULL THEN
      DELETE FROM public.organization_members
      WHERE organization_id = NEW.id
        AND profile_id = OLD.primary_contact_id
        AND role = 'admin';

      DELETE FROM public.project_members pm
      USING public.projects p
      WHERE p.id = pm.project_id
        AND p.organization_id = NEW.id
        AND pm.profile_id = OLD.primary_contact_id
        AND pm.role = 'observer';
    END IF;
  END IF;

  IF NEW.primary_contact_id IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, profile_id, role)
    VALUES (NEW.id, NEW.primary_contact_id, 'admin')
    ON CONFLICT (organization_id, profile_id)
    DO UPDATE SET role = 'admin';

    INSERT INTO public.project_members (project_id, profile_id, role)
    SELECT p.id, NEW.primary_contact_id, 'observer'
    FROM public.projects p
    WHERE p.organization_id = NEW.id
    ON CONFLICT (project_id, profile_id)
    DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_org_primary_contact_admin_membership ON public.organizations;
CREATE TRIGGER trg_sync_org_primary_contact_admin_membership
AFTER INSERT OR UPDATE OF primary_contact_id ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.sync_org_primary_contact_admin_membership();

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_status_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project team view projects" ON public.projects;
CREATE POLICY "Project team view projects"
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_project_team_member(id)
    OR public.is_project_org_admin(id)
  );

DROP POLICY IF EXISTS "Project team create projects" ON public.projects;
CREATE POLICY "Project team create projects"
  ON public.projects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR owner_profile_id = public.current_profile_id()
    OR public.can_create_projects_for_org(organization_id)
  );

DROP POLICY IF EXISTS "Project team update projects" ON public.projects;
CREATE POLICY "Project team update projects"
  ON public.projects
  FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR public.is_project_content_editor(id))
  WITH CHECK (public.is_admin() OR public.is_project_content_editor(id));

DROP POLICY IF EXISTS "Project owners delete projects" ON public.projects;
CREATE POLICY "Project owners delete projects"
  ON public.projects
  FOR DELETE
  TO authenticated
  USING (public.is_admin() OR public.is_project_owner_member(id));

DROP POLICY IF EXISTS "Project team view project members" ON public.project_members;
CREATE POLICY "Project team view project members"
  ON public.project_members
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.is_project_team_member(project_id));

DROP POLICY IF EXISTS "Project owners insert project members" ON public.project_members;
CREATE POLICY "Project owners insert project members"
  ON public.project_members
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() OR public.is_project_owner_member(project_id));

DROP POLICY IF EXISTS "Project owners update project members" ON public.project_members;
CREATE POLICY "Project owners update project members"
  ON public.project_members
  FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR public.is_project_owner_member(project_id))
  WITH CHECK (public.is_admin() OR public.is_project_owner_member(project_id));

DROP POLICY IF EXISTS "Project owners delete project members" ON public.project_members;
CREATE POLICY "Project owners delete project members"
  ON public.project_members
  FOR DELETE
  TO authenticated
  USING (public.is_admin() OR public.is_project_owner_member(project_id));

DROP POLICY IF EXISTS "Project team view project milestones" ON public.project_milestones;
CREATE POLICY "Project team view project milestones"
  ON public.project_milestones
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.is_project_team_member(project_id));

DROP POLICY IF EXISTS "Project content editors insert project milestones" ON public.project_milestones;
CREATE POLICY "Project content editors insert project milestones"
  ON public.project_milestones
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() OR public.is_project_content_editor(project_id));

DROP POLICY IF EXISTS "Project content editors update project milestones" ON public.project_milestones;
CREATE POLICY "Project content editors update project milestones"
  ON public.project_milestones
  FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR public.is_project_content_editor(project_id))
  WITH CHECK (public.is_admin() OR public.is_project_content_editor(project_id));

DROP POLICY IF EXISTS "Project content editors delete project milestones" ON public.project_milestones;
CREATE POLICY "Project content editors delete project milestones"
  ON public.project_milestones
  FOR DELETE
  TO authenticated
  USING (public.is_admin() OR public.is_project_content_editor(project_id));

DROP POLICY IF EXISTS "Project team view project tasks" ON public.project_tasks;
CREATE POLICY "Project team view project tasks"
  ON public.project_tasks
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.is_project_team_member(project_id));

DROP POLICY IF EXISTS "Project content editors insert project tasks" ON public.project_tasks;
CREATE POLICY "Project content editors insert project tasks"
  ON public.project_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() OR public.is_project_content_editor(project_id));

DROP POLICY IF EXISTS "Project content editors update project tasks" ON public.project_tasks;
CREATE POLICY "Project content editors update project tasks"
  ON public.project_tasks
  FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR public.is_project_content_editor(project_id))
  WITH CHECK (public.is_admin() OR public.is_project_content_editor(project_id));

DROP POLICY IF EXISTS "Project content editors delete project tasks" ON public.project_tasks;
CREATE POLICY "Project content editors delete project tasks"
  ON public.project_tasks
  FOR DELETE
  TO authenticated
  USING (public.is_admin() OR public.is_project_content_editor(project_id));

DROP POLICY IF EXISTS "Project team view project links" ON public.project_links;
CREATE POLICY "Project team view project links"
  ON public.project_links
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.is_project_team_member(project_id));

DROP POLICY IF EXISTS "Project team create project links" ON public.project_links;
CREATE POLICY "Project team create project links"
  ON public.project_links
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin() OR public.is_project_team_member(project_id));

DROP POLICY IF EXISTS "Project content editors update project links" ON public.project_links;
CREATE POLICY "Project content editors update project links"
  ON public.project_links
  FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR public.is_project_content_editor(project_id))
  WITH CHECK (public.is_admin() OR public.is_project_content_editor(project_id));

DROP POLICY IF EXISTS "Project content editors delete project links" ON public.project_links;
CREATE POLICY "Project content editors delete project links"
  ON public.project_links
  FOR DELETE
  TO authenticated
  USING (public.is_admin() OR public.is_project_content_editor(project_id));

DROP POLICY IF EXISTS "Project team view project status log" ON public.project_status_log;
CREATE POLICY "Project team view project status log"
  ON public.project_status_log
  FOR SELECT
  TO authenticated
  USING (public.is_admin() OR public.is_project_team_member(project_id));

INSERT INTO public.organization_members (organization_id, profile_id, role)
SELECT o.id, o.primary_contact_id, 'admin'
FROM public.organizations o
WHERE o.primary_contact_id IS NOT NULL
ON CONFLICT (organization_id, profile_id)
DO UPDATE SET role = 'admin';

INSERT INTO public.project_members (project_id, profile_id, role)
SELECT p.id, o.primary_contact_id, 'observer'
FROM public.projects p
JOIN public.organizations o ON o.id = p.organization_id
WHERE o.primary_contact_id IS NOT NULL
ON CONFLICT (project_id, profile_id)
DO NOTHING;
