-- When a company website URL changes, disable stale monitor rows and reset status on the new URL.

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
begin
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
    is_enabled
  )
  values (
    new.org_id,
    new.id,
    normalized_url,
    new.name,
    'company',
    true
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
      metadata = '{}'::jsonb,
      updated_at = now()
    where org_id = new.org_id
      and url = normalized_url
      and company_id = new.id;
  end if;

  return new;
end;
$$;

-- Backfill: disable monitor rows whose URL no longer matches the company record.
update public.monitored_websites mw
set
  is_enabled = false,
  updated_at = now()
where mw.source = 'company'
  and mw.company_id is not null
  and mw.is_enabled = true
  and not exists (
    select 1
    from public.companies c
    where c.id = mw.company_id
      and c.org_id = mw.org_id
      and public.normalize_website_monitor_url(c.website) = mw.url
  );
