-- Hostinger weekly auto-sync toggle and scheduled portfolio refresh.

alter table public.organization_hostinger_settings
  add column if not exists weekly_sync_enabled boolean not null default true;

comment on column public.organization_hostinger_settings.weekly_sync_enabled is
  'When true, portfolio sync runs automatically once per week via pg_cron.';

create or replace function public.invoke_hostinger_sync_cron()
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
    url := rtrim(project_url, '/') || '/functions/v1/hostinger_sync_cron',
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

comment on function public.invoke_hostinger_sync_cron() is
  'Invokes hostinger_sync_cron edge function weekly for orgs with auto-sync enabled.';

grant execute on function public.invoke_hostinger_sync_cron() to service_role;

do $cron_setup$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'hostinger_sync_weekly'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'hostinger_sync_weekly',
    '0 6 * * 1',
    $$select public.invoke_hostinger_sync_cron();$$
  );
end;
$cron_setup$;
