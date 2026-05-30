-- Phase 2: schedule stale website audit sweep (~every 5 min, 150s grace).

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'fail_stale_website_audits_5m'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'fail_stale_website_audits_5m',
    '*/5 * * * *',
    $$ select public.fail_stale_website_audits(150); $$
  );
end;
$$;

comment on function public.fail_stale_website_audits(integer) is
  'Marks stuck website_audits as failed. Scheduled every 5 minutes via pg_cron (Phase 2).';
