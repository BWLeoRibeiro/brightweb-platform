-- Saved CRM audience filters for consent-first marketing campaigns.
create table if not exists public.marketing_segments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  rule_json jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.marketing_campaigns
  add column if not exists segment_id uuid
  references public.marketing_segments(id) on delete set null;

create index if not exists marketing_segments_created_at_idx
  on public.marketing_segments (created_at desc);

create index if not exists marketing_campaigns_segment_id_idx
  on public.marketing_campaigns (segment_id)
  where segment_id is not null;

create index if not exists marketing_message_events_engagement_idx
  on public.marketing_message_events (event_type, occurred_at desc, contact_id)
  where contact_id is not null;

drop trigger if exists set_marketing_segments_updated_at on public.marketing_segments;
create trigger set_marketing_segments_updated_at
  before update on public.marketing_segments
  for each row execute function public.set_marketing_updated_at();

alter table public.marketing_segments enable row level security;

drop policy if exists "Service role manages marketing segments"
  on public.marketing_segments;
create policy "Service role manages marketing segments"
  on public.marketing_segments for all to service_role
  using (true) with check (true);

revoke all on table public.marketing_segments from anon, authenticated;
grant all on table public.marketing_segments to service_role;
