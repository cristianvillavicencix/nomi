-- =====================================================================
-- companies.is_client — derived bill-to signal (NOT a pipeline field)
-- =====================================================================
-- True when:
--   - any linked contact has status = 'client', OR
--   - any linked deal has stage in ('closed_won', 'won')
-- Synced by triggers; not manually editable from UI.
-- Does NOT change contacts.status / contacts.lead_stage logic.
-- =====================================================================

alter table public.companies
  add column if not exists is_client boolean not null default false;

comment on column public.companies.is_client is
  'Derived: true if any contact is status=client or any deal stage is closed_won/won. Not a pipeline field.';

create index if not exists companies_is_client_idx
  on public.companies (is_client)
  where is_client = true;

-- ---------------------------------------------------------------------
-- Sync function
-- ---------------------------------------------------------------------
create or replace function public.sync_company_is_client(p_company_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_client boolean;
begin
  if p_company_id is null then
    return;
  end if;

  select exists (
    select 1
    from public.contacts co
    where co.company_id = p_company_id
      and co.status = 'client'
  ) or exists (
    select 1
    from public.deals d
    where d.company_id = p_company_id
      and d.stage in ('closed_won', 'won')
  )
  into v_is_client;

  update public.companies c
  set is_client = coalesce(v_is_client, false)
  where c.id = p_company_id
    and c.is_client is distinct from coalesce(v_is_client, false);
end;
$$;

comment on function public.sync_company_is_client(bigint) is
  'Sets companies.is_client from linked client contacts or closed_won/won deals.';

revoke all on function public.sync_company_is_client(bigint) from public;
grant execute on function public.sync_company_is_client(bigint) to service_role;

-- ---------------------------------------------------------------------
-- Contacts triggers
-- ---------------------------------------------------------------------
create or replace function public.trg_contacts_sync_company_is_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_company_is_client(old.company_id);
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if old.company_id is distinct from new.company_id then
      perform public.sync_company_is_client(old.company_id);
    end if;
    if old.company_id is distinct from new.company_id
      or old.status is distinct from new.status then
      perform public.sync_company_is_client(new.company_id);
    end if;
    return new;
  end if;

  -- INSERT
  perform public.sync_company_is_client(new.company_id);
  return new;
end;
$$;

drop trigger if exists trg_contacts_sync_company_is_client on public.contacts;
create trigger trg_contacts_sync_company_is_client
  after insert or update of company_id, status or delete
  on public.contacts
  for each row
  execute function public.trg_contacts_sync_company_is_client();

-- ---------------------------------------------------------------------
-- Deals triggers
-- ---------------------------------------------------------------------
create or replace function public.trg_deals_sync_company_is_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_company_is_client(old.company_id);
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if old.company_id is distinct from new.company_id then
      perform public.sync_company_is_client(old.company_id);
    end if;
    if old.company_id is distinct from new.company_id
      or old.stage is distinct from new.stage then
      perform public.sync_company_is_client(new.company_id);
    end if;
    return new;
  end if;

  perform public.sync_company_is_client(new.company_id);
  return new;
end;
$$;

drop trigger if exists trg_deals_sync_company_is_client on public.deals;
create trigger trg_deals_sync_company_is_client
  after insert or update of company_id, stage or delete
  on public.deals
  for each row
  execute function public.trg_deals_sync_company_is_client();

-- ---------------------------------------------------------------------
-- Backfill
-- ---------------------------------------------------------------------
update public.companies c
set is_client = true
where c.is_client = false
  and (
    exists (
      select 1 from public.contacts co
      where co.company_id = c.id and co.status = 'client'
    )
    or exists (
      select 1 from public.deals d
      where d.company_id = c.id and d.stage in ('closed_won', 'won')
    )
  );

-- ---------------------------------------------------------------------
-- Expose on companies_summary (list/getOne remaps)
-- ---------------------------------------------------------------------
drop view if exists public.companies_summary;

create view public.companies_summary
with (security_invoker = on)
as
select
  c.id,
  c.created_at,
  c.name,
  c.sector,
  c.size,
  c.linkedin_url,
  c.website,
  c.phone_number,
  c.address,
  c.zipcode,
  c.city,
  c.state_abbr,
  c.organization_member_id,
  c.context_links,
  c.country,
  c.description,
  c.revenue,
  c.tax_identifier,
  c.logo,
  c.org_id,
  c.is_client,
  coalesce(c.primary_contact_id, pc.resolved_primary_contact_id) as primary_contact_id,
  (
    select count(*)::bigint
    from public.deals d
    where d.company_id = c.id
  ) as nb_deals,
  (
    select count(*)::bigint
    from public.contacts co
    where co.company_id = c.id
  ) as nb_contacts,
  pc.primary_contact_first_name,
  pc.primary_contact_last_name,
  pc.primary_contact_status,
  pc.primary_contact_email_jsonb,
  pc.primary_contact_phone_jsonb,
  pc.primary_contact_lead_source,
  pc.primary_contact_interested_service
from public.companies c
left join lateral (
  select
    pco.id as resolved_primary_contact_id,
    pco.first_name as primary_contact_first_name,
    pco.last_name as primary_contact_last_name,
    pco.status as primary_contact_status,
    pco.email_jsonb as primary_contact_email_jsonb,
    pco.phone_jsonb as primary_contact_phone_jsonb,
    pco.lead_source as primary_contact_lead_source,
    pco.interested_service as primary_contact_interested_service
  from public.contacts pco
  where pco.company_id = c.id
    and (c.primary_contact_id is null or pco.id = c.primary_contact_id)
  order by
    case when c.primary_contact_id is not null and pco.id = c.primary_contact_id then 0 else 1 end,
    case when pco.status = 'client' then 0 else 1 end,
    pco.first_seen asc nulls last,
    pco.id asc
  limit 1
) pc on true;

grant select on public.companies_summary to authenticated;
grant select on public.companies_summary to service_role;
