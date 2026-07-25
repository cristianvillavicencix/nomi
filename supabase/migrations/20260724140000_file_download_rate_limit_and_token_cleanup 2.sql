-- Rate-limit logging for public file_download + purge helpers for expired tokens.

create table if not exists public.file_download_request_log (
  id bigint generated always as identity primary key,
  ip_address text not null,
  created_at timestamptz not null default now()
);

create index if not exists file_download_request_log_ip_created_idx
  on public.file_download_request_log (ip_address, created_at desc);

alter table public.file_download_request_log enable row level security;

comment on table public.file_download_request_log is
  'Short-lived IP request log for file_download rate limiting (service_role only).';

grant select, insert, delete on public.file_download_request_log to service_role;

create or replace function public.purge_expired_storage_file_access_tokens()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.storage_file_access_tokens
  where expires_at < now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

comment on function public.purge_expired_storage_file_access_tokens() is
  'Delete expired storage_file_access_tokens rows.';

grant execute on function public.purge_expired_storage_file_access_tokens() to service_role;

create or replace function public.purge_old_file_download_request_log()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.file_download_request_log
  where created_at < now() - interval '24 hours';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

comment on function public.purge_old_file_download_request_log() is
  'Delete file_download_request_log rows older than 24 hours.';

grant execute on function public.purge_old_file_download_request_log() to service_role;

do $cron_setup$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'purge_storage_file_access_tokens_daily';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'purge_storage_file_access_tokens_daily',
    '15 4 * * *',
    $$select public.purge_expired_storage_file_access_tokens(); select public.purge_old_file_download_request_log();$$
  );
end;
$cron_setup$;
