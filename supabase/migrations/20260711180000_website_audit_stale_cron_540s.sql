-- Heartbeat running callbacks refresh started_at; 540s grace for parallel dual-run audits.

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
    'select public.fail_stale_website_audits(540);'
  );
end;
$$;
