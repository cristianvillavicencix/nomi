-- Booking notifications: guest SMS tracking, prep task link, realtime for in-app alerts.

alter table public.public_bookings
  add column if not exists guest_confirmation_sent_at timestamptz,
  add column if not exists guest_reminder_sent_at timestamptz,
  add column if not exists task_id bigint references public.tasks (id) on delete set null;

comment on column public.public_bookings.guest_confirmation_sent_at is
  'When the guest received an SMS booking confirmation.';
comment on column public.public_bookings.guest_reminder_sent_at is
  'When the guest received an SMS reminder before the appointment.';
comment on column public.public_bookings.task_id is
  'Prep task created for the host when the booking was confirmed.';

create index if not exists public_bookings_guest_reminder_pending_idx
  on public.public_bookings (event_date, event_time)
  where status = 'confirmed'
    and guest_phone is not null
    and guest_reminder_sent_at is null;

alter table public.public_bookings replica identity full;

do $realtime$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'public_bookings'
  ) then
    alter publication supabase_realtime add table public.public_bookings;
  end if;
end;
$realtime$;

-- Calendar reminder cron (host follow-ups + guest booking reminders) every 5 minutes.
create or replace function public.invoke_send_calendar_reminders()
returns bigint
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  project_url text;
  cron_secret text;
  request_id bigint;
begin
  select decrypted_secret into project_url
  from vault.decrypted_secrets
  where name = 'website_monitor_project_url'
  limit 1;

  select decrypted_secret into cron_secret
  from vault.decrypted_secrets
  where name = 'website_monitor_cron_secret'
  limit 1;

  if project_url is null or cron_secret is null then
    return null;
  end if;

  select net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/send_calendar_reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', cron_secret
    ),
    body := '{}'::jsonb
  )
  into request_id;

  return request_id;
end;
$$;

comment on function public.invoke_send_calendar_reminders() is
  'Invokes send_calendar_reminders edge function (host + guest booking SMS reminders).';

grant execute on function public.invoke_send_calendar_reminders() to service_role;

do $cron_setup$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'send_calendar_reminders_every_5m'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'send_calendar_reminders_every_5m',
    '*/5 * * * *',
    $$select public.invoke_send_calendar_reminders();$$
  );
end;
$cron_setup$;
