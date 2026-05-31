-- Real worker progress phase + longer stale grace for unified audits.

alter table public.website_audits
  add column if not exists progress_phase text;

comment on column public.website_audits.progress_phase is
  'Worker heartbeat phase: static | mobile | desktop | crux';

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
    'select public.fail_stale_website_audits(960);'
  );
end;
$$;
