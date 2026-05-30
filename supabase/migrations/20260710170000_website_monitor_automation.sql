-- Automatic website monitor checks (pg_cron) and immediate check on new sites.

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

create extension if not exists pg_net with schema extensions;

create or replace function public.invoke_website_monitor_run()
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
    url := rtrim(project_url, '/') || '/functions/v1/website_monitor_run',
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

create or replace function public.invoke_website_monitor_check(target_website_id bigint)
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
  if target_website_id is null then
    return null;
  end if;

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
    url := rtrim(project_url, '/') || '/functions/v1/website_monitor_check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', cron_secret
    ),
    body := jsonb_build_object(
      'monitored_website_id', target_website_id,
      'include_metadata', true
    )
  )
  into request_id;

  return request_id;
end;
$$;

create or replace function public.trg_monitored_website_enqueue_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_enabled then
    perform public.invoke_website_monitor_check(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_monitored_websites_enqueue_check on public.monitored_websites;
create trigger trg_monitored_websites_enqueue_check
  after insert or update of url, is_enabled on public.monitored_websites
  for each row
  when (new.is_enabled)
  execute function public.trg_monitored_website_enqueue_check();

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'website_monitor_run_every_5m'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'website_monitor_run_every_5m',
    '*/5 * * * *',
    'select public.invoke_website_monitor_run();'
  );
end;
$$;

comment on function public.invoke_website_monitor_run() is
  'Invokes website_monitor_run edge function (requires vault secrets).';
comment on function public.invoke_website_monitor_check(bigint) is
  'Invokes website_monitor_check for one site (requires vault secrets).';
