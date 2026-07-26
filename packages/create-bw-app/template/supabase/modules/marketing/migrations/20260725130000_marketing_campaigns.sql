create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  preheader text,
  from_name text,
  from_email text,
  topic_id uuid not null references public.marketing_topics(id),
  body_html text,
  body_text text,
  body_json jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'sending', 'sent', 'canceled', 'failed')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  batch_size integer not null default 100 check (batch_size > 0),
  rate_per_minute integer check (rate_per_minute is null or rate_per_minute > 0),
  total_recipients integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_by_profile_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  contact_id uuid references public.crm_contacts(id) on delete set null,
  email text not null,
  status text not null default 'queued'
    check (status in ('queued', 'sending', 'sent', 'failed', 'suppressed', 'skipped')),
  attempt_count integer not null default 0,
  next_attempt_at timestamptz,
  provider_message_id text,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, contact_id)
);

create index if not exists marketing_campaign_recipients_campaign_status_idx
  on public.marketing_campaign_recipients (campaign_id, status);
create index if not exists marketing_campaign_recipients_worker_claim_idx
  on public.marketing_campaign_recipients (status, next_attempt_at);
create index if not exists marketing_campaign_recipients_provider_message_idx
  on public.marketing_campaign_recipients (provider_message_id)
  where provider_message_id is not null;

create table if not exists public.marketing_message_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  recipient_id uuid references public.marketing_campaign_recipients(id) on delete set null,
  contact_id uuid,
  provider text not null default 'resend',
  event_type text not null,
  provider_event_id text,
  payload jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists marketing_message_events_provider_event_unique_idx
  on public.marketing_message_events (provider, provider_event_id)
  where provider_event_id is not null;

alter table public.marketing_campaigns enable row level security;
alter table public.marketing_campaign_recipients enable row level security;
alter table public.marketing_message_events enable row level security;

drop policy if exists "service role manages marketing campaigns" on public.marketing_campaigns;
create policy "service role manages marketing campaigns"
  on public.marketing_campaigns for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role manages marketing campaign recipients"
  on public.marketing_campaign_recipients;
create policy "service role manages marketing campaign recipients"
  on public.marketing_campaign_recipients for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role manages marketing message events"
  on public.marketing_message_events;
create policy "service role manages marketing message events"
  on public.marketing_message_events for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop trigger if exists marketing_campaigns_set_updated_at on public.marketing_campaigns;
create trigger marketing_campaigns_set_updated_at
  before update on public.marketing_campaigns
  for each row execute function public.set_marketing_updated_at();

drop trigger if exists marketing_campaign_recipients_set_updated_at
  on public.marketing_campaign_recipients;
create trigger marketing_campaign_recipients_set_updated_at
  before update on public.marketing_campaign_recipients
  for each row execute function public.set_marketing_updated_at();

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
      updated_at = claim_time
  where id in (
    select id
    from public.marketing_campaign_recipients
    where campaign_id = target_campaign_id
      and status = 'queued'
      and (next_attempt_at is null or next_attempt_at <= claim_time)
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
