-- Org-level Web Monitor module settings (notifications, defaults, enable/disable).

alter table public.organizations
  add column if not exists website_monitor_settings jsonb not null default '{
    "enabled": true,
    "sms_alerts_enabled": true,
    "auto_sync": true,
    "default_check_interval_minutes": 5,
    "default_slow_threshold_ms": 3000,
    "default_alert_on_down": true,
    "default_alert_on_slow": false,
    "default_alert_on_ssl": true,
    "alert_cooldown_hours": 6
  }'::jsonb;

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
    "alert_cooldown_hours": 6
  }'::jsonb;
begin
  select website_monitor_settings
  into raw
  from public.organizations
  where id = target_org_id;

  return defaults || coalesce(raw, '{}'::jsonb);
end;
$$;

grant execute on function public.get_website_monitor_settings(bigint) to authenticated;
grant execute on function public.get_website_monitor_settings(bigint) to service_role;

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
    alert_on_ssl
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
    coalesce((settings ->> 'default_alert_on_ssl')::boolean, true)
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
    alert_on_ssl
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
    coalesce((settings ->> 'default_alert_on_ssl')::boolean, true)
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

comment on column public.organizations.website_monitor_settings is
  'Web Monitor module: enable/disable, SMS alerts, sync, defaults for new sites.';
