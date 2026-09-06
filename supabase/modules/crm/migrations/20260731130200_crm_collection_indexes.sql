-- Support contains-search and the most common CRM collection filters/sorts.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS crm_contacts_first_name_trgm_idx
  ON public.crm_contacts USING gin (first_name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS crm_contacts_last_name_trgm_idx
  ON public.crm_contacts USING gin (last_name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS crm_contacts_email_trgm_idx
  ON public.crm_contacts USING gin (email extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS crm_contacts_phone_trgm_idx
  ON public.crm_contacts USING gin (phone extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS crm_contacts_status_updated_idx
  ON public.crm_contacts (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS crm_contacts_organization_updated_idx
  ON public.crm_contacts (organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS crm_contacts_owner_updated_idx
  ON public.crm_contacts (owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS crm_contacts_source_updated_idx
  ON public.crm_contacts (source, updated_at DESC);
CREATE INDEX IF NOT EXISTS crm_status_log_reason_trgm_idx
  ON public.crm_status_log USING gin (reason extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS crm_status_log_contact_changed_idx
  ON public.crm_status_log (contact_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS crm_status_log_actor_changed_idx
  ON public.crm_status_log (changed_by_user_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS crm_status_log_status_changed_idx
  ON public.crm_status_log (new_status, changed_at DESC);

CREATE OR REPLACE FUNCTION public.get_crm_contact_stats()
RETURNS TABLE (
  total_count bigint,
  lead_count bigint,
  qualified_count bigint,
  proposal_count bigint,
  won_count bigint,
  lost_count bigint,
  qualified_last_30_days bigint,
  won_last_30_days bigint,
  new_last_7_days bigint,
  new_last_30_days bigint,
  new_last_year bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH contact_counts AS (
    SELECT
      count(*) AS total_count,
      count(*) FILTER (WHERE status = 'lead') AS lead_count,
      count(*) FILTER (WHERE status = 'qualified') AS qualified_count,
      count(*) FILTER (WHERE status = 'proposal') AS proposal_count,
      count(*) FILTER (WHERE status = 'won') AS won_count,
      count(*) FILTER (WHERE status = 'lost') AS lost_count,
      count(*) FILTER (WHERE created_at >= now() - interval '7 days') AS new_last_7_days,
      count(*) FILTER (WHERE created_at >= now() - interval '30 days') AS new_last_30_days,
      count(*) FILTER (WHERE created_at >= now() - interval '365 days') AS new_last_year
    FROM public.crm_contacts
  ),
  activity_counts AS (
    SELECT
      count(*) FILTER (WHERE new_status = 'qualified' AND changed_at >= now() - interval '30 days') AS qualified_last_30_days,
      count(*) FILTER (WHERE new_status = 'won' AND changed_at >= now() - interval '30 days') AS won_last_30_days
    FROM public.crm_status_log
    WHERE changed_at >= now() - interval '30 days'
  )
  SELECT
    contacts.total_count,
    contacts.lead_count,
    contacts.qualified_count,
    contacts.proposal_count,
    contacts.won_count,
    contacts.lost_count,
    activity.qualified_last_30_days,
    activity.won_last_30_days,
    contacts.new_last_7_days,
    contacts.new_last_30_days,
    contacts.new_last_year
  FROM contact_counts contacts
  CROSS JOIN activity_counts activity;
$$;

CREATE OR REPLACE FUNCTION public.search_crm_status_timeline(
  p_search text,
  p_since timestamptz,
  p_contact_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  contact_id uuid,
  previous_status text,
  new_status text,
  reason text,
  changed_at timestamptz,
  changed_by_user_id uuid,
  changed_by_label text,
  contact_label text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT
    log.id,
    log.contact_id,
    log.previous_status::text,
    log.new_status::text,
    log.reason,
    log.changed_at,
    log.changed_by_user_id,
    nullif(trim(concat_ws(' ', actor.first_name, actor.last_name)), '') AS changed_by_label,
    coalesce(
      nullif(trim(concat_ws(' ', contact.first_name, contact.last_name)), ''),
      contact.email,
      'Contacto'
    ) AS contact_label
  FROM public.crm_status_log log
  JOIN public.crm_contacts contact ON contact.id = log.contact_id
  LEFT JOIN public.profiles actor ON actor.user_id = log.changed_by_user_id
  WHERE log.changed_at >= p_since
    AND (p_contact_id IS NULL OR log.contact_id = p_contact_id)
    AND (
      nullif(trim(p_search), '') IS NULL
      OR contact.first_name ILIKE '%' || trim(p_search) || '%'
      OR contact.last_name ILIKE '%' || trim(p_search) || '%'
      OR concat_ws(' ', contact.first_name, contact.last_name) ILIKE '%' || trim(p_search) || '%'
      OR contact.email ILIKE '%' || trim(p_search) || '%'
      OR actor.first_name ILIKE '%' || trim(p_search) || '%'
      OR actor.last_name ILIKE '%' || trim(p_search) || '%'
      OR concat_ws(' ', actor.first_name, actor.last_name) ILIKE '%' || trim(p_search) || '%'
      OR actor.email ILIKE '%' || trim(p_search) || '%'
      OR log.reason ILIKE '%' || trim(p_search) || '%'
      OR log.new_status::text ILIKE '%' || trim(p_search) || '%'
      OR CASE log.new_status::text
        WHEN 'lead' THEN 'novo'
        WHEN 'qualified' THEN 'qualificado'
        WHEN 'proposal' THEN 'proposta'
        WHEN 'won' THEN 'ganho'
        WHEN 'lost' THEN 'perdido'
        ELSE log.new_status::text
      END ILIKE '%' || trim(p_search) || '%'
    )
  ORDER BY log.changed_at DESC
  LIMIT least(greatest(coalesce(p_limit, 10), 1), 100);
$$;

REVOKE ALL ON FUNCTION public.get_crm_contact_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_crm_status_timeline(text, timestamptz, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_crm_contact_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_crm_status_timeline(text, timestamptz, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_crm_contact_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.search_crm_status_timeline(text, timestamptz, uuid, integer) TO service_role;
