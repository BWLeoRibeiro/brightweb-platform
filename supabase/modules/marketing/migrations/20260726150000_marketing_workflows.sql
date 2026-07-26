create table if not exists public.marketing_workflows (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  trigger_type text not null
    check (trigger_type in (
      'contact_subscribed',
      'crm_status_changed',
      'project_status_changed',
      'form_submitted'
    )),
  trigger_config jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused')),
  created_by_profile_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_workflow_nodes (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null
    references public.marketing_workflows(id) on delete cascade,
  position integer not null,
  node_type text not null
    check (node_type in ('send_email', 'wait', 'add_tag')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workflow_id, position)
);

create index if not exists marketing_workflow_nodes_workflow_position_idx
  on public.marketing_workflow_nodes (workflow_id, position);

create table if not exists public.marketing_workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null
    references public.marketing_workflows(id) on delete cascade,
  contact_id uuid references public.crm_contacts(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'completed', 'failed', 'canceled')),
  current_position integer not null default 0,
  next_run_at timestamptz,
  context jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workflow_id, contact_id)
);

create index if not exists marketing_workflow_runs_due_idx
  on public.marketing_workflow_runs (status, next_run_at);

create table if not exists public.marketing_workflow_step_runs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null
    references public.marketing_workflow_runs(id) on delete cascade,
  node_id uuid references public.marketing_workflow_nodes(id) on delete set null,
  status text not null check (status in ('done', 'failed', 'skipped')),
  error text,
  executed_at timestamptz not null default now()
);

create table if not exists public.marketing_contact_tags (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.crm_contacts(id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now(),
  unique (contact_id, tag)
);

create table if not exists public.marketing_worker_cursors (
  key text primary key,
  cursor timestamptz
);

alter table public.marketing_workflows enable row level security;
alter table public.marketing_workflow_nodes enable row level security;
alter table public.marketing_workflow_runs enable row level security;
alter table public.marketing_workflow_step_runs enable row level security;
alter table public.marketing_contact_tags enable row level security;
alter table public.marketing_worker_cursors enable row level security;

drop policy if exists "service role manages marketing workflows"
  on public.marketing_workflows;
create policy "service role manages marketing workflows"
  on public.marketing_workflows for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role manages marketing workflow nodes"
  on public.marketing_workflow_nodes;
create policy "service role manages marketing workflow nodes"
  on public.marketing_workflow_nodes for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role manages marketing workflow runs"
  on public.marketing_workflow_runs;
create policy "service role manages marketing workflow runs"
  on public.marketing_workflow_runs for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role manages marketing workflow step runs"
  on public.marketing_workflow_step_runs;
create policy "service role manages marketing workflow step runs"
  on public.marketing_workflow_step_runs for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role manages marketing contact tags"
  on public.marketing_contact_tags;
create policy "service role manages marketing contact tags"
  on public.marketing_contact_tags for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role manages marketing worker cursors"
  on public.marketing_worker_cursors;
create policy "service role manages marketing worker cursors"
  on public.marketing_worker_cursors for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop trigger if exists marketing_workflows_set_updated_at
  on public.marketing_workflows;
create trigger marketing_workflows_set_updated_at
  before update on public.marketing_workflows
  for each row execute function public.set_marketing_updated_at();

drop trigger if exists marketing_workflow_nodes_set_updated_at
  on public.marketing_workflow_nodes;
create trigger marketing_workflow_nodes_set_updated_at
  before update on public.marketing_workflow_nodes
  for each row execute function public.set_marketing_updated_at();

drop trigger if exists marketing_workflow_runs_set_updated_at
  on public.marketing_workflow_runs;
create trigger marketing_workflow_runs_set_updated_at
  before update on public.marketing_workflow_runs
  for each row execute function public.set_marketing_updated_at();

create or replace function public.claim_marketing_workflow_runs(
  claim_limit integer,
  claim_time timestamptz default now()
)
returns setof public.marketing_workflow_runs
language sql
security definer
set search_path = public
as $$
  update public.marketing_workflow_runs
  set next_run_at = claim_time + interval '5 minutes',
      updated_at = claim_time
  where id in (
    select id
    from public.marketing_workflow_runs
    where status = 'active'
      and next_run_at is not null
      and next_run_at <= claim_time
    order by next_run_at, created_at, id
    for update skip locked
    limit greatest(1, least(claim_limit, 100))
  )
  returning *;
$$;

revoke all on function public.claim_marketing_workflow_runs(integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_marketing_workflow_runs(integer, timestamptz)
  to service_role;
