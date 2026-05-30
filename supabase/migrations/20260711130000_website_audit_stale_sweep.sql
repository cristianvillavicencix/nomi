-- Optional safety net for orphaned website_audits (queued/running past timeout).
-- NOT scheduled in Phase 1 — run manually or wire to pg_cron after measuring real audit durations.
--
-- Example (every 10 min, 150s grace):
--   select cron.schedule(
--     'fail-stale-website-audits',
--     '*/10 * * * *',
--     $$ select public.fail_stale_website_audits(150); $$
--   );

create or replace function public.fail_stale_website_audits(
  max_age_seconds integer default 150
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  if max_age_seconds is null or max_age_seconds < 30 then
    max_age_seconds := 150;
  end if;

  update public.website_audits
  set
    status = 'failed',
    completed_at = now(),
    error_message = coalesce(
      error_message,
      'Audit expirado: sin callback del worker dentro de '
        || max_age_seconds::text
        || ' segundos (barrido automático).'
    )
  where status in ('queued', 'running')
    and coalesce(started_at, requested_at)
      < now() - make_interval(secs => max_age_seconds);

  GET DIAGNOSTICS affected = ROW_COUNT;
  return affected;
end;
$$;

comment on function public.fail_stale_website_audits(integer) is
  'Marks stuck website_audits as failed. Recommended cron safety net; not enabled in Phase 1.';

grant execute on function public.fail_stale_website_audits(integer) to service_role;
