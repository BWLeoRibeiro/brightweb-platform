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

      PERFORM public.log_app_activity_event(
        'projects',
        CASE WHEN NEW.status IS DISTINCT FROM OLD.status THEN 'project_status_changed' ELSE 'project_updated' END,
        'projects',
        NEW.id,
        v_summary,
        jsonb_strip_nulls(
          jsonb_build_object(
            'project_id', NEW.id,
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
