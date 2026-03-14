-- Mirror of BrightWeb canonical migration:
-- brightweb-platform/supabase/modules/projects/migrations/20260311107000_projects_activity_bus_split_v1.sql

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
      v_changes := v_changes || jsonb_build_object(
        'name',
        jsonb_build_object('from', OLD.name, 'to', NEW.name)
      );
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_changes := v_changes || jsonb_build_object(
        'status',
        jsonb_build_object('from', OLD.status, 'to', NEW.status)
      );
    END IF;

    IF NEW.target_date IS DISTINCT FROM OLD.target_date THEN
      v_changes := v_changes || jsonb_build_object(
        'target_date',
        jsonb_build_object('from', OLD.target_date, 'to', NEW.target_date)
      );
    END IF;

    IF NEW.owner_profile_id IS DISTINCT FROM OLD.owner_profile_id THEN
      v_changes := v_changes || jsonb_build_object(
        'owner_profile_id',
        jsonb_build_object('from', OLD.owner_profile_id, 'to', NEW.owner_profile_id)
      );
    END IF;

    IF NEW.summary IS DISTINCT FROM OLD.summary THEN
      v_changes := v_changes || jsonb_build_object(
        'summary',
        jsonb_build_object('from', OLD.summary, 'to', NEW.summary)
      );
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
