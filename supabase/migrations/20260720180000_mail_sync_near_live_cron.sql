-- Near-live CRM Mail sync: due window 1 minute + pg_cron every minute.
-- Reuses vault secrets: website_monitor_project_url + website_monitor_cron_secret
-- (same as marketing / invoice billing crons). Edge mail_sync accepts x-cron-secret.

create or replace function public.mail_accounts_due_for_sync(p_limit int default 20)
returns setof public.mail_accounts
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.mail_accounts
  where status = 'connected'
    and (
      last_sync_at is null
      or last_sync_at < now() - interval '1 minute'
    )
  order by last_sync_at nulls first
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

revoke all on function public.mail_accounts_due_for_sync(int) from public;
grant execute on function public.mail_accounts_due_for_sync(int) to service_role;

comment on function public.mail_accounts_due_for_sync(int) is
  'Connected mail accounts due for incremental sync (last_sync_at older than 1 minute).';

create or replace function public.invoke_mail_sync_cron()
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
    url := rtrim(project_url, '/') || '/functions/v1/mail_sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', cron_secret
    ),
    body := jsonb_build_object(
      'action', 'cron',
      'limit', 20
    )
  )
  into request_id;

  return request_id;
end;
$$;

comment on function public.invoke_mail_sync_cron() is
  'Invokes mail_sync edge function every minute for near-live inbox updates.';

grant execute on function public.invoke_mail_sync_cron() to service_role;

do $cron_setup$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'mail_sync_every_minute'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'mail_sync_every_minute',
    '* * * * *',
    $$select public.invoke_mail_sync_cron();$$
  );
end;
$cron_setup$;
