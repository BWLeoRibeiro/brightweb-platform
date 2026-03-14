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
      v_changes := v_changes || jsonb_build_object(
        'description',
        jsonb_build_object('from', OLD.description, 'to', NEW.description)
      );
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
      v_changes := v_changes || jsonb_build_object(
        'blocked_reason',
        jsonb_build_object('from', OLD.blocked_reason, 'to', NEW.blocked_reason)
      );
    END IF;

    IF v_changes <> '{}'::jsonb THEN
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
          'changes', v_changes
        )
      );
    END IF;

    RETURN NEW;
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
    PERFORM public.log_app_activity_event(
      'projects',
      'milestone_created',
      'project_milestones',
      NEW.id,
      'Milestone criada: ' || COALESCE(NULLIF(btrim(NEW.title), ''), 'Sem título'),
      jsonb_build_object(
        'milestone_id', NEW.id,
        'project_id', NEW.project_id,
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
      PERFORM public.log_app_activity_event(
        'projects',
        CASE WHEN NEW.status IS DISTINCT FROM OLD.status THEN 'milestone_status_changed' ELSE 'milestone_updated' END,
        'project_milestones',
        NEW.id,
        CASE
          WHEN NEW.status IS DISTINCT FROM OLD.status
            THEN 'Estado da milestone alterado: ' || COALESCE(NULLIF(btrim(NEW.title), ''), 'Sem título')
          ELSE 'Milestone atualizada: ' || COALESCE(NULLIF(btrim(NEW.title), ''), 'Sem título')
        END,
        jsonb_build_object(
          'milestone_id', NEW.id,
          'project_id', NEW.project_id,
          'previous_status', OLD.status,
          'new_status', NEW.status,
          'changes', v_changes
        )
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_project_milestones_activity_event ON public.project_milestones;
CREATE TRIGGER trg_log_project_milestones_activity_event
AFTER INSERT OR UPDATE ON public.project_milestones
FOR EACH ROW
EXECUTE FUNCTION public.log_project_milestones_activity_event();

CREATE OR REPLACE FUNCTION public.log_project_members_activity_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_app_activity_event(
      'projects',
      'member_added',
      'project_members',
      NEW.id,
      'Membro adicionado à equipa do projeto',
      jsonb_build_object(
        'member_id', NEW.id,
        'project_id', NEW.project_id,
        'profile_id', NEW.profile_id,
        'role', NEW.role
      )
    );

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      PERFORM public.log_app_activity_event(
        'projects',
        'member_role_changed',
        'project_members',
        NEW.id,
        'Função de membro atualizada na equipa do projeto',
        jsonb_build_object(
          'member_id', NEW.id,
          'project_id', NEW.project_id,
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
    PERFORM public.log_app_activity_event(
      'projects',
      'member_removed',
      'project_members',
      OLD.id,
      'Membro removido da equipa do projeto',
      jsonb_build_object(
        'member_id', OLD.id,
        'project_id', OLD.project_id,
        'profile_id', OLD.profile_id,
        'role', OLD.role
      )
    );

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_project_members_activity_event ON public.project_members;
CREATE TRIGGER trg_log_project_members_activity_event
AFTER INSERT OR UPDATE OR DELETE ON public.project_members
FOR EACH ROW
EXECUTE FUNCTION public.log_project_members_activity_event();
