alter table public.marketing_worker_cursors
  add column if not exists cursor_id uuid;

with duplicate_steps as (
  select
    id,
    row_number() over (
      partition by run_id, node_id
      order by executed_at, id
    ) as duplicate_number
  from public.marketing_workflow_step_runs
  where node_id is not null
)
delete from public.marketing_workflow_step_runs
where id in (
  select id
  from duplicate_steps
  where duplicate_number > 1
);

create unique index if not exists marketing_workflow_step_runs_run_node_idx
  on public.marketing_workflow_step_runs (run_id, node_id)
  where node_id is not null;

create or replace function public.claim_marketing_campaign_recipients(
  target_campaign_id uuid,
  claim_limit integer,
  claim_time timestamptz default now()
)
returns setof public.marketing_campaign_recipients
language sql
security definer
set search_path = public
as $$
  update public.marketing_campaign_recipients
  set status = 'sending',
      attempt_count = attempt_count + 1,
      next_attempt_at = null,
      updated_at = claim_time
  where id in (
    select id
    from public.marketing_campaign_recipients
    where campaign_id = target_campaign_id
      and (
        status = 'queued'
        or (
          status = 'failed'
          and attempt_count < 3
          and next_attempt_at is not null
          and next_attempt_at <= claim_time
        )
        or (
          status = 'sending'
          and attempt_count < 3
          and updated_at <= claim_time - interval '15 minutes'
        )
      )
    order by created_at, id
    for update skip locked
    limit greatest(1, least(claim_limit, 1000))
  )
  returning *;
$$;

revoke all on function public.claim_marketing_campaign_recipients(uuid, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_marketing_campaign_recipients(uuid, integer, timestamptz)
  to service_role;
