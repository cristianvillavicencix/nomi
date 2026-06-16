-- Stop the web-monitor / website-audit egress drain.
-- 1. Disable all web monitoring crons (manual mode from now on).
-- 2. Install a daily retention sweep so monitor data never piles up again.
--
-- One-shot cleanup of accumulated rows is intentionally not in this migration
-- (it runs once via SQL Editor — see notes below).

-- Step 1: disable web monitor / audit crons
update cron.job
set active = false
where jobname in (
  'website_monitor_run_every_5m',
  'website_audit_push_retry',
  'website_audit_schedule_daily',
  'fail_stale_website_audits',
  'fail_stale_website_audits_5m'
);

-- Step 2: retention sweep function
create or replace function public.cleanup_old_web_monitor_data()
returns void
language plpgsql
security definer
as $$
begin
  delete from public.website_checks
  where created_at < now() - interval '1 day';

  delete from public.audit_findings
  where audit_id in (
    select id from public.website_audits
    where created_at < now() - interval '7 days'
  );

  delete from public.website_audits
  where created_at < now() - interval '7 days';

  delete from public.website_monitor_changes
  where detected_at < now() - interval '7 days';
end;
$$;

comment on function public.cleanup_old_web_monitor_data() is
  'Daily retention sweep for web monitor tables. Keeps website_checks <1 day, audits/findings/changes <7 days.';

-- Step 3: schedule the sweep every day at 03:00 UTC
do $cron_setup$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'cleanup_old_web_monitor_data_daily'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'cleanup_old_web_monitor_data_daily',
    '0 3 * * *',
    'select public.cleanup_old_web_monitor_data();'
  );
end;
$cron_setup$;
