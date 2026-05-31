-- Phase 4: scheduled web audits, push retry queue, score-drop alert columns.

alter table public.monitored_websites
  add column if not exists audit_schedule_enabled boolean not null default false,
  add column if not exists audit_interval_days integer not null default 30
    check (audit_interval_days >= 1 and audit_interval_days <= 365),
  add column if not exists audit_alert_on_score_drop boolean not null default true,
  add column if not exists audit_score_drop_threshold smallint not null default 10
    check (audit_score_drop_threshold >= 1 and audit_score_drop_threshold <= 100),
  add column if not exists last_audit_score_alert_at timestamptz;

alter table public.website_audits
  add column if not exists worker_push_attempts smallint not null default 0
    check (worker_push_attempts >= 0 and worker_push_attempts <= 20),
  add column if not exists last_worker_push_at timestamptz,
  add column if not exists scheduled boolean not null default false;

create index if not exists monitored_websites_audit_schedule_idx
  on public.monitored_websites (org_id, audit_schedule_enabled)
  where is_enabled = true and audit_schedule_enabled = true;

create index if not exists website_audits_push_retry_idx
  on public.website_audits (status, last_worker_push_at)
  where status = 'queued';

comment on column public.monitored_websites.audit_schedule_enabled is
  'When true, cron enqueues a Web Report on audit_interval_days.';
comment on column public.website_audits.scheduled is
  'True when the audit was created by the schedule cron (not manual).';

-- Extend org-level Web Monitor settings with audit defaults.
create or replace function public.get_website_monitor_settings(target_org_id bigint)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  raw jsonb;
  defaults jsonb := '{
    "enabled": true,
    "sms_alerts_enabled": true,
    "auto_sync": true,
    "default_check_interval_minutes": 5,
    "default_slow_threshold_ms": 3000,
    "default_alert_on_down": true,
    "default_alert_on_slow": false,
    "default_alert_on_ssl": true,
    "alert_cooldown_hours": 6,
    "default_audit_schedule_enabled": false,
    "default_audit_interval_days": 30,
    "default_audit_alert_on_score_drop": true,
    "default_audit_score_drop_threshold": 10
  }'::jsonb;
begin
  select website_monitor_settings
  into raw
  from public.organizations
  where id = target_org_id;

  return defaults || coalesce(raw, '{}'::jsonb);
end;
$$;

-- Apply audit defaults when syncing company websites.
create or replace function public.sync_monitored_websites_for_org(target_org_id bigint)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  upserted_count integer := 0;
  settings jsonb;
  site_enabled boolean := true;
begin
  settings := public.get_website_monitor_settings(target_org_id);

  if coalesce((settings ->> 'enabled')::boolean, true) = false then
    return 0;
  end if;

  if coalesce((settings ->> 'auto_sync')::boolean, true) = false then
    return 0;
  end if;

  insert into public.monitored_websites (
    org_id,
    company_id,
    url,
    display_name,
    source,
    is_enabled,
    slow_threshold_ms,
    check_interval_minutes,
    alert_on_down,
    alert_on_slow,
    alert_on_ssl,
    audit_schedule_enabled,
    audit_interval_days,
    audit_alert_on_score_drop,
    audit_score_drop_threshold
  )
  select distinct on (c.org_id, public.normalize_website_monitor_url(c.website))
    c.org_id,
    c.id,
    public.normalize_website_monitor_url(c.website),
    c.name,
    'company',
    site_enabled,
    greatest(coalesce((settings ->> 'default_slow_threshold_ms')::integer, 3000), 500),
    greatest(coalesce((settings ->> 'default_check_interval_minutes')::integer, 5), 1),
    coalesce((settings ->> 'default_alert_on_down')::boolean, true),
    coalesce((settings ->> 'default_alert_on_slow')::boolean, false),
    coalesce((settings ->> 'default_alert_on_ssl')::boolean, true),
    coalesce((settings ->> 'default_audit_schedule_enabled')::boolean, false),
    greatest(coalesce((settings ->> 'default_audit_interval_days')::integer, 30), 1),
    coalesce((settings ->> 'default_audit_alert_on_score_drop')::boolean, true),
    greatest(least(coalesce((settings ->> 'default_audit_score_drop_threshold')::integer, 10), 100), 1)::smallint
  from public.companies c
  where c.org_id = target_org_id
    and public.normalize_website_monitor_url(c.website) is not null
  order by c.org_id, public.normalize_website_monitor_url(c.website), c.id
  on conflict (org_id, url) do update
  set
    company_id = excluded.company_id,
    display_name = coalesce(excluded.display_name, public.monitored_websites.display_name),
    source = 'company',
    is_enabled = true,
    updated_at = now();

  get diagnostics upserted_count = row_count;

  update public.monitored_websites mw
  set
    is_enabled = false,
    updated_at = now()
  where mw.org_id = target_org_id
    and mw.source = 'company'
    and mw.company_id is not null
    and not exists (
      select 1
      from public.companies c
      where c.id = mw.company_id
        and public.normalize_website_monitor_url(c.website) = mw.url
        and c.org_id = target_org_id
    );

  return upserted_count;
end;
$$;

create or replace function public.trg_company_sync_monitored_website()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_url text;
  previous_url text;
  url_changed boolean := false;
  settings jsonb;
begin
  settings := public.get_website_monitor_settings(new.org_id);

  if coalesce((settings ->> 'enabled')::boolean, true) = false
     or coalesce((settings ->> 'auto_sync')::boolean, true) = false then
    return new;
  end if;

  normalized_url := public.normalize_website_monitor_url(new.website);

  if tg_op = 'UPDATE' then
    previous_url := public.normalize_website_monitor_url(old.website);
    url_changed := previous_url is distinct from normalized_url;
  end if;

  if normalized_url is null then
    update public.monitored_websites
    set is_enabled = false, updated_at = now()
    where company_id = new.id and org_id = new.org_id;
    return new;
  end if;

  insert into public.monitored_websites (
    org_id,
    company_id,
    url,
    display_name,
    source,
    is_enabled,
    slow_threshold_ms,
    check_interval_minutes,
    alert_on_down,
    alert_on_slow,
    alert_on_ssl,
    audit_schedule_enabled,
    audit_interval_days,
    audit_alert_on_score_drop,
    audit_score_drop_threshold
  )
  values (
    new.org_id,
    new.id,
    normalized_url,
    new.name,
    'company',
    true,
    greatest(coalesce((settings ->> 'default_slow_threshold_ms')::integer, 3000), 500),
    greatest(coalesce((settings ->> 'default_check_interval_minutes')::integer, 5), 1),
    coalesce((settings ->> 'default_alert_on_down')::boolean, true),
    coalesce((settings ->> 'default_alert_on_slow')::boolean, false),
    coalesce((settings ->> 'default_alert_on_ssl')::boolean, true),
    coalesce((settings ->> 'default_audit_schedule_enabled')::boolean, false),
    greatest(coalesce((settings ->> 'default_audit_interval_days')::integer, 30), 1),
    coalesce((settings ->> 'default_audit_alert_on_score_drop')::boolean, true),
    greatest(least(coalesce((settings ->> 'default_audit_score_drop_threshold')::integer, 10), 100), 1)::smallint
  )
  on conflict (org_id, url) do update
  set
    company_id = excluded.company_id,
    display_name = excluded.display_name,
    is_enabled = true,
    updated_at = now();

  update public.monitored_websites
  set
    is_enabled = false,
    updated_at = now()
  where org_id = new.org_id
    and company_id = new.id
    and source = 'company'
    and url is distinct from normalized_url;

  if tg_op = 'INSERT' or url_changed then
    update public.monitored_websites
    set
      last_status = 'unknown',
      last_response_ms = null,
      last_http_status = null,
      last_checked_at = null,
      last_error = null,
      ssl_expires_at = null,
      ssl_days_remaining = null,
      dns_ip = null,
      dns_nameservers = '{}',
      dns_mx = '{}',
      hosting_provider = null,
      hosting_confidence = null,
      tech_stack = '{}',
      page_title = null,
      domain_name = public.extract_domain_from_url(normalized_url),
      metadata = '{}'::jsonb,
      updated_at = now()
    where org_id = new.org_id
      and url = normalized_url;
  end if;

  return new;
end;
$$;

create or replace function public.invoke_website_audit_schedule(schedule_mode text default 'all')
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
    url := rtrim(project_url, '/') || '/functions/v1/website_audit_schedule',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', cron_secret
    ),
    body := jsonb_build_object('mode', coalesce(schedule_mode, 'all'))
  )
  into request_id;

  return request_id;
end;
$$;

comment on function public.invoke_website_audit_schedule(text) is
  'Invokes website_audit_schedule edge function (mode: retry | due | all).';

grant execute on function public.invoke_website_audit_schedule(text) to service_role;

-- Push retry every 5 minutes; scheduled audits once daily at 07:00 UTC.
do $cron_setup$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'website_audit_push_retry'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'website_audit_push_retry',
    '*/5 * * * *',
    'select public.invoke_website_audit_schedule(''retry'');'
  );

  select jobid into existing_job_id
  from cron.job
  where jobname = 'website_audit_schedule_daily'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'website_audit_schedule_daily',
    '0 7 * * *',
    'select public.invoke_website_audit_schedule(''due'');'
  );

  select jobid into existing_job_id
  from cron.job
  where jobname = 'fail_stale_website_audits'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  select jobid into existing_job_id
  from cron.job
  where jobname = 'fail_stale_website_audits_5m'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'fail_stale_website_audits',
    '*/15 * * * *',
    'select public.fail_stale_website_audits(900);'
  );
end;
$cron_setup$;
