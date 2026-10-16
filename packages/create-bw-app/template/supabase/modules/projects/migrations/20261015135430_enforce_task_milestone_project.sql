-- A task's optional milestone must belong to its required project.
-- Read-only rollout preflight (also enforced below):
-- SELECT count(*) AS invalid_task_milestone_relationships
-- FROM public.project_tasks task
-- LEFT JOIN public.project_milestones milestone ON milestone.id = task.milestone_id
-- WHERE task.milestone_id IS NOT NULL
--   AND (milestone.id IS NULL OR task.project_id IS DISTINCT FROM milestone.project_id);

-- One statement keeps preflight, constraint replacement and index creation
-- atomic even for SQL clients that apply migrations statement by statement.
DO $$
DECLARE
  v_invalid_count bigint;
BEGIN
  -- Exclude writes before inspecting legacy rows. Acquire the eventual DDL
  -- locks up front, avoiding lock upgrades between preflight and validation.
  LOCK TABLE public.project_milestones, public.project_tasks IN ACCESS EXCLUSIVE MODE;

  SELECT count(*) INTO v_invalid_count
  FROM public.project_tasks task
  LEFT JOIN public.project_milestones milestone ON milestone.id = task.milestone_id
  WHERE task.milestone_id IS NOT NULL
    AND (milestone.id IS NULL OR task.project_id IS DISTINCT FROM milestone.project_id);

  IF v_invalid_count > 0 THEN
    RAISE EXCEPTION 'Projects relationship migration refused: invalid task/milestone relationships exist.'
      USING ERRCODE = '23514',
        DETAIL = format('invalid_task_milestone_relationships=%s', v_invalid_count),
        HINT = 'Run the read-only aggregate preflight at the top of this migration. Review and remediate affected data separately before retrying; this migration does not repair records.';
  END IF;

  ALTER TABLE public.project_milestones
    ADD CONSTRAINT project_milestones_id_project_id_key UNIQUE (id, project_id);

  -- Retain one relationship and its existing PostgREST hint name. MATCH SIMPLE
  -- permits an absent milestone; only milestone_id is cleared on deletion.
  ALTER TABLE public.project_tasks
    DROP CONSTRAINT project_tasks_milestone_id_fkey,
    ADD CONSTRAINT project_tasks_milestone_id_fkey
      FOREIGN KEY (milestone_id, project_id)
      REFERENCES public.project_milestones (id, project_id)
      MATCH SIMPLE
      ON UPDATE NO ACTION
      ON DELETE SET NULL (milestone_id)
      NOT DEFERRABLE;

  CREATE INDEX idx_project_tasks_milestone_project
    ON public.project_tasks (milestone_id, project_id);

  PERFORM pg_catalog.pg_notify('pgrst', 'reload schema');
END;
$$;
