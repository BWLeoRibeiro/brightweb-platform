-- Add bounded client-visible meta previews before destructive cleanup. Keep the
-- legacy next-steps output during this compatibility phase so upgraded readers
-- can deploy while older consumers still understand the previous RPC shape.

DROP FUNCTION public.get_current_client_project(uuid);
DROP FUNCTION public.list_current_client_projects();

CREATE FUNCTION public.list_current_client_projects()
RETURNS TABLE (
  project_id uuid,
  name text,
  reference text,
  status text,
  start_date date,
  target_date date,
  completed_at timestamptz,
  archived_at timestamptz,
  client_summary text,
  client_scope text,
  client_contact jsonb,
  client_next_steps text,
  meta_preview jsonb,
  organizations jsonb,
  progress_percent integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    project.id,
    project.name,
    project.code,
    project.status,
    project.start_date,
    project.target_date,
    project.completed_at,
    project.archived_at,
    project.client_summary,
    project.client_scope,
    CASE WHEN contact.id IS NULL THEN NULL ELSE jsonb_build_object(
      'profile_id', contact.id,
      'name', COALESCE(NULLIF(btrim(concat_ws(' ', contact.first_name, contact.last_name)), ''), contact.email),
      'email', contact.email
    ) END,
    project.client_next_steps,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', current_meta.id,
        'title', current_meta.title,
        'status', current_meta.status,
        'target_date', current_meta.target_date,
        'completed_at', current_meta.completed_at,
        'position', current_meta.position
      ) ORDER BY current_meta.position, current_meta.target_date, current_meta.id)
      FROM (
        SELECT milestone.*
        FROM public.project_milestones milestone
        WHERE milestone.project_id = project.id
          AND milestone.visibility = 'client'
          AND milestone.status IN ('in_progress', 'delayed')
        ORDER BY milestone.position, milestone.target_date, milestone.id
        LIMIT 3
      ) current_meta
    ), (
      SELECT jsonb_agg(jsonb_build_object(
        'id', pending_meta.id,
        'title', pending_meta.title,
        'status', pending_meta.status,
        'target_date', pending_meta.target_date,
        'completed_at', pending_meta.completed_at,
        'position', pending_meta.position
      ) ORDER BY pending_meta.position, pending_meta.target_date, pending_meta.id)
      FROM (
        SELECT milestone.*
        FROM public.project_milestones milestone
        WHERE milestone.project_id = project.id
          AND milestone.visibility = 'client'
          AND milestone.status = 'pending'
        ORDER BY milestone.position, milestone.target_date, milestone.id
        LIMIT 1
      ) pending_meta
    ), '[]'::jsonb),
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', organization.id, 'name', organization.name) ORDER BY organization.name)
      FROM public.project_client_organizations audience
      JOIN public.organization_members org_member
        ON org_member.organization_id = audience.organization_id
       AND org_member.profile_id = public.current_profile_id()
      JOIN public.organizations organization ON organization.id = audience.organization_id
      WHERE audience.project_id = project.id
        AND (
          project.client_access_mode = 'all_org_clients'
          OR EXISTS (
            SELECT 1 FROM public.project_client_profiles grant_row
            WHERE grant_row.project_id = project.id
              AND grant_row.organization_id = audience.organization_id
              AND grant_row.profile_id = public.current_profile_id()
          )
        )
    ), '[]'::jsonb),
    CASE WHEN count(milestone.id) = 0 THEN 0
      ELSE round(100.0 * count(milestone.id) FILTER (WHERE milestone.status = 'achieved') / count(milestone.id))::integer
    END
  FROM public.projects project
  LEFT JOIN public.profiles contact ON contact.id = project.client_contact_profile_id
  LEFT JOIN public.project_milestones milestone
    ON milestone.project_id = project.id AND milestone.visibility = 'client'
  WHERE public.can_current_client_view_project(project.id)
  GROUP BY project.id, contact.id
  ORDER BY project.updated_at DESC;
$$;

REVOKE ALL ON FUNCTION public.list_current_client_projects()
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.list_current_client_projects()
  TO authenticated;

CREATE FUNCTION public.get_current_client_project(target_project_id uuid)
RETURNS TABLE (
  project_id uuid,
  name text,
  reference text,
  status text,
  start_date date,
  target_date date,
  completed_at timestamptz,
  archived_at timestamptz,
  client_summary text,
  client_scope text,
  client_contact jsonb,
  client_next_steps text,
  meta_preview jsonb,
  organizations jsonb,
  progress_percent integer,
  metas jsonb,
  documents jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    list_row.project_id,
    list_row.name,
    list_row.reference,
    list_row.status,
    list_row.start_date,
    list_row.target_date,
    list_row.completed_at,
    list_row.archived_at,
    list_row.client_summary,
    list_row.client_scope,
    list_row.client_contact,
    list_row.client_next_steps,
    list_row.meta_preview,
    list_row.organizations,
    list_row.progress_percent,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', milestone.id,
        'title', milestone.title,
        'status', milestone.status,
        'target_date', milestone.target_date,
        'completed_at', milestone.completed_at,
        'position', milestone.position
      ) ORDER BY milestone.position, milestone.target_date, milestone.id)
      FROM public.project_milestones milestone
      WHERE milestone.project_id = target_project_id
        AND milestone.visibility = 'client'
    ), '[]'::jsonb),
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', link.id,
        'label', link.label,
        'url', link.url,
        'kind', link.kind,
        'created_at', link.created_at
      ) ORDER BY link.created_at DESC, link.id)
      FROM public.project_links link
      WHERE link.project_id = target_project_id
        AND link.visibility = 'client'
    ), '[]'::jsonb)
  FROM public.list_current_client_projects() list_row
  WHERE list_row.project_id = target_project_id;
$$;

REVOKE ALL ON FUNCTION public.get_current_client_project(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_current_client_project(uuid)
  TO authenticated;
