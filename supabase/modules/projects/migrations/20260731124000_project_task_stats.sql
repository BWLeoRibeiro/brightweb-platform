-- Aggregate portfolio task counters in Postgres so list and dashboard requests
-- transfer one row per project instead of every task row.

CREATE OR REPLACE VIEW public.project_task_stats
WITH (security_invoker = true)
AS
SELECT
  project_id,
  count(*) AS total,
  count(*) FILTER (WHERE status = 'done') AS done,
  count(*) FILTER (
    WHERE due_date < CURRENT_DATE
      AND status <> 'done'
  ) AS overdue,
  count(*) FILTER (WHERE status = 'blocked') AS blocked
FROM public.project_tasks
GROUP BY project_id;

REVOKE ALL ON TABLE public.project_task_stats FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.project_task_stats TO authenticated, service_role;
