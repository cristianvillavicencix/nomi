-- Promote contacts from lead statuses to `client` when they are clearly clients:
-- linked to a deal, marked primary on a company, or won with a company assigned.
--
-- Fixes rows that stayed in Leads / Clients→Contactos after deal or client creation.

-- ---------------------------------------------------------------------
-- 1. Shared helper
-- ---------------------------------------------------------------------
create or replace function public.promote_contact_to_client(p_contact_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_contact_id is null then
    return;
  end if;

  update public.contacts c
  set status = 'client'
  where c.id = p_contact_id
    and c.status in ('lead', 'warm', 'cold', 'prospect');
end;
$$;

comment on function public.promote_contact_to_client(bigint) is
  'Sets contacts.status to client when the person is still on a lead lifecycle bucket.';

-- ---------------------------------------------------------------------
-- 2. Deal sync: also promote linked contact to client
-- ---------------------------------------------------------------------
create or replace function public.sync_deal_stage_to_contact_lead_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_lead_stage text;
  v_should_freeze     boolean;
begin
  if new.contact_id is null then
    return new;
  end if;

  perform public.promote_contact_to_client(new.contact_id);

  if TG_OP = 'UPDATE' and new.stage is not distinct from old.stage then
    return new;
  end if;

  v_target_lead_stage := case new.stage
    when 'won'           then 'won'
    when 'closed_won'    then 'won'
    when 'closed_lost'   then 'lost'
    when 'proposal_sent' then 'quoted'
    when 'discovery'     then 'talking'
    else null
  end;

  v_should_freeze := new.stage in ('won', 'closed_won', 'closed_lost');

  update public.contacts c
  set
    lead_stage = coalesce(v_target_lead_stage, c.lead_stage),
    snooze_until = case
      when v_should_freeze then '2099-12-31 00:00:00+00'::timestamptz
      else c.snooze_until
    end
  where c.id = new.contact_id
    and (
      (v_target_lead_stage is not null
       and c.lead_stage is distinct from v_target_lead_stage)
      or (v_should_freeze
          and c.snooze_until is distinct from '2099-12-31 00:00:00+00'::timestamptz)
    );

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Contacts: won + company, or primary/deal linkage → client
-- ---------------------------------------------------------------------
create or replace function public.promote_contact_to_client_on_contact_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status not in ('lead', 'warm', 'cold', 'prospect') then
    return new;
  end if;

  if new.lead_stage = 'won' and new.company_id is not null then
    new.status := 'client';
    return new;
  end if;

  if exists (
    select 1
    from public.companies co
    where co.primary_contact_id = new.id
  ) then
    new.status := 'client';
    return new;
  end if;

  if exists (
    select 1
    from public.deals d
    where d.contact_id = new.id
  ) then
    new.status := 'client';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_promote_contact_to_client on public.contacts;

create trigger trg_promote_contact_to_client
  before insert or update on public.contacts
  for each row
  execute function public.promote_contact_to_client_on_contact_change();

-- ---------------------------------------------------------------------
-- 4. Companies: assigning primary contact promotes them
-- ---------------------------------------------------------------------
create or replace function public.sync_primary_contact_client_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.primary_contact_id is not null
     and (
       TG_OP = 'INSERT'
       or new.primary_contact_id is distinct from old.primary_contact_id
     ) then
    perform public.promote_contact_to_client(new.primary_contact_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_primary_contact_client_status on public.companies;

create trigger trg_sync_primary_contact_client_status
  after insert or update on public.companies
  for each row
  execute function public.sync_primary_contact_client_status();

-- ---------------------------------------------------------------------
-- 5. Backfill existing inconsistent rows
-- ---------------------------------------------------------------------
update public.contacts c
set status = 'client'
where c.status in ('lead', 'warm', 'cold', 'prospect')
  and (
    exists (
      select 1
      from public.companies co
      where co.primary_contact_id = c.id
    )
    or exists (
      select 1
      from public.deals d
      where d.contact_id = c.id
    )
    or (c.lead_stage = 'won' and c.company_id is not null)
  );
