-- Ticket inbound extras: retry payloads, pipeline email alerts, cron worker

alter table public.ticket_inbound_failures
  add column if not exists raw_payload jsonb,
  add column if not exists retry_count int not null default 0,
  add column if not exists last_retry_at timestamptz;

alter table public.ticket_inboxes
  add column if not exists pipeline_stale_notified_at timestamptz;

comment on column public.ticket_inbound_failures.raw_payload is
  'Serialized inbound payload for operator retry without manual .eml import.';

create or replace function public.invoke_check_ticket_inbound_pipeline_cron()
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
    url := rtrim(project_url, '/') || '/functions/v1/check_ticket_inbound_pipeline',
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

comment on function public.invoke_check_ticket_inbound_pipeline_cron() is
  'Invokes check_ticket_inbound_pipeline edge function every 6 hours.';

grant execute on function public.invoke_check_ticket_inbound_pipeline_cron() to service_role;

do $cron_setup$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'check_ticket_inbound_pipeline_every_6h'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'check_ticket_inbound_pipeline_every_6h',
    '0 */6 * * *',
    $$select public.invoke_check_ticket_inbound_pipeline_cron();$$
  );
end;
$cron_setup$;
