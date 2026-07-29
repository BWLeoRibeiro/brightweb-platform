create or replace function public.process_marketing_resend_webhook(
  p_provider_event_id text,
  p_event_type text,
  p_provider_message_id text,
  p_payload jsonb,
  p_occurred_at timestamptz
)
returns table (duplicate boolean, event_type text, recipient_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient public.marketing_campaign_recipients%rowtype;
  inserted_event_id uuid;
  suppression_reason text;
  normalized_email text;
begin
  if nullif(trim(p_provider_message_id), '') is not null then
    select * into recipient
    from public.marketing_campaign_recipients
    where provider_message_id = p_provider_message_id
    order by id
    limit 1;
  end if;

  insert into public.marketing_message_events (
    campaign_id,
    recipient_id,
    contact_id,
    provider,
    event_type,
    provider_event_id,
    payload,
    occurred_at
  ) values (
    recipient.campaign_id,
    recipient.id,
    recipient.contact_id,
    'resend',
    p_event_type,
    nullif(trim(p_provider_event_id), ''),
    p_payload,
    coalesce(p_occurred_at, now())
  )
  on conflict (provider, provider_event_id) where provider_event_id is not null
  do nothing
  returning id into inserted_event_id;

  if inserted_event_id is null then
    return query select true, p_event_type, recipient.id;
    return;
  end if;

  if recipient.id is not null and p_event_type in ('delivered', 'sent') then
    update public.marketing_campaign_recipients
    set status = 'sent',
        sent_at = coalesce(p_occurred_at, now()),
        error = null
    where id = recipient.id;
  elsif recipient.id is not null and p_event_type = 'failed' then
    update public.marketing_campaign_recipients
    set status = 'failed',
        error = 'Resend reported delivery failure.'
    where id = recipient.id;
  elsif recipient.id is not null and p_event_type in ('bounced', 'complained', 'unsubscribed') then
    suppression_reason := case p_event_type
      when 'bounced' then 'bounced'
      when 'complained' then 'complained'
      else 'unsubscribed_all'
    end;
    normalized_email := lower(trim(recipient.email));

    update public.marketing_campaign_recipients
    set status = 'suppressed',
        error = 'Resend reported ' || p_event_type || '.',
        next_attempt_at = null
    where id = recipient.id;

    insert into public.marketing_suppressions (email, reason, source)
    values (normalized_email, suppression_reason, 'resend_webhook')
    on conflict (email) do update
      set reason = excluded.reason,
          source = excluded.source;

    update public.marketing_campaign_recipients
    set status = 'suppressed',
        error = 'Email suppressed: ' || suppression_reason || '.',
        next_attempt_at = null
    where lower(trim(email)) = normalized_email
      and status in ('queued', 'sending');

    if recipient.contact_id is not null then
      update public.marketing_subscriptions
      set status = 'unsubscribed',
          unsubscribed_at = coalesce(p_occurred_at, now())
      where contact_id = recipient.contact_id;
    end if;
  end if;

  return query select false, p_event_type, recipient.id;
end;
$$;

revoke all on function public.process_marketing_resend_webhook(text, text, text, jsonb, timestamptz) from public;
grant execute on function public.process_marketing_resend_webhook(text, text, text, jsonb, timestamptz) to service_role;
