-- =====================================================================
-- Contact membership sync (Option C): single source of truth for
-- contacts.status derived from lead_stage + closed_won deals.
--
-- Rules:
--   client  <=  lead_stage = 'won'  OR  deal.stage in ('closed_won','won')
--   unearned client (no closed_won, lead_stage <> won) -> lead + lead_stage new
--   lost    => stay in lead bucket, freeze snooze
--   contact_only / inactive => unchanged unless closed_won promotes to client
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Core sync function
-- ---------------------------------------------------------------------
create or replace function public.sync_contact_membership(p_contact_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.contacts%rowtype;
  v_has_closed_won boolean;
  v_target_status text;
  v_target_lead_stage text;
  v_target_snooze timestamptz;
  v_frozen constant timestamptz := '2099-12-31 00:00:00+00'::timestamptz;
begin
  if p_contact_id is null then
    return;
  end if;

  select * into v_row from public.contacts where id = p_contact_id;
  if not found then
    return;
  end if;

  select exists (
    select 1
    from public.deals d
    where d.contact_id = p_contact_id
      and d.stage in ('closed_won', 'won')
  ) into v_has_closed_won;

  if v_row.status in ('contact_only', 'inactive') then
    if v_has_closed_won then
      update public.contacts c
      set
        status = 'client',
        lead_stage = 'won',
        snooze_until = v_frozen
      where c.id = p_contact_id
        and (
          c.status is distinct from 'client'
          or c.lead_stage is distinct from 'won'
          or c.snooze_until is distinct from v_frozen
        );
    end if;
    return;
  end if;

  if v_has_closed_won or v_row.lead_stage = 'won' then
    v_target_status := 'client';
    v_target_lead_stage := 'won';
    v_target_snooze := v_frozen;
  elsif v_row.lead_stage = 'lost' then
    v_target_status := case
      when v_row.status = 'client' then 'lead'
      when v_row.status in ('lead', 'prospect') then v_row.status
      else 'lead'
    end;
    v_target_lead_stage := 'lost';
    v_target_snooze := v_frozen;
  elsif v_row.status = 'client' then
    v_target_status := 'lead';
    v_target_lead_stage := 'new';
    v_target_snooze := null;
  else
    v_target_status := case coalesce(v_row.status, '')
      when 'prospect' then 'prospect'
      when 'lead' then 'lead'
      when 'warm' then 'prospect'
      when 'cold' then 'prospect'
      when 'new' then 'lead'
      when 'contact' then 'contact_only'
      when 'hot' then 'prospect'
      else 'lead'
    end;

    if v_target_status in ('contact_only', 'inactive') then
      return;
    end if;

    v_target_lead_stage := coalesce(nullif(v_row.lead_stage, ''), 'new');
    if v_target_lead_stage = 'won' then
      v_target_lead_stage := 'new';
    end if;

    v_target_snooze := case
      when v_row.lead_stage in ('won', 'lost') then null
      else v_row.snooze_until
    end;
  end if;

  update public.contacts c
  set
    status = v_target_status,
    lead_stage = v_target_lead_stage,
    snooze_until = v_target_snooze
  where c.id = p_contact_id
    and (
      c.status is distinct from v_target_status
      or c.lead_stage is distinct from v_target_lead_stage
      or c.snooze_until is distinct from v_target_snooze
    );
end;
$$;

comment on function public.sync_contact_membership(bigint) is
  'Derives contacts.status from lead_stage and closed_won deals. Demotes unearned client rows to lead/new.';

-- ---------------------------------------------------------------------
-- 2. Deal stage -> lead_stage (existing) + membership sync
-- ---------------------------------------------------------------------
create or replace function public.sync_deal_stage_to_contact_lead_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_lead_stage text;
  v_should_freeze boolean;
begin
  if new.contact_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.stage is not distinct from old.stage then
    return new;
  end if;

  v_target_lead_stage := case new.stage
    when 'won' then 'won'
    when 'closed_won' then 'won'
    when 'closed_lost' then 'lost'
    when 'proposal_sent' then 'quoted'
    when 'pending_payment' then 'closing'
    when 'discovery' then 'talking'
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

  perform public.sync_contact_membership(new.contact_id);

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Replace legacy promotion triggers with membership sync
-- ---------------------------------------------------------------------
create or replace function public.promote_contact_to_client(p_contact_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_contact_membership(p_contact_id);
end;
$$;

comment on function public.promote_contact_to_client(bigint) is
  'Deprecated name — calls sync_contact_membership().';

drop trigger if exists trg_promote_contact_to_client on public.contacts;

create or replace function public.trg_contacts_sync_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_contact_membership(new.id);
  return new;
end;
$$;

drop trigger if exists trg_contacts_sync_membership on public.contacts;

create trigger trg_contacts_sync_membership
  after insert or update on public.contacts
  for each row
  execute function public.trg_contacts_sync_membership();

create or replace function public.sync_primary_contact_client_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.primary_contact_id is not null
     and (
       tg_op = 'INSERT'
       or new.primary_contact_id is distinct from old.primary_contact_id
     ) then
    perform public.sync_contact_membership(new.primary_contact_id);
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Backfill: legacy status vocabulary + unearned clients -> lead/new
-- ---------------------------------------------------------------------
update public.contacts
set status = case coalesce(status, '')
  when 'contact' then 'contact_only'
  when 'warm' then 'prospect'
  when 'cold' then 'prospect'
  when 'hot' then 'prospect'
  when 'new' then 'lead'
  else status
end
where status in ('contact', 'warm', 'cold', 'hot', 'new');

update public.contacts c
set
  status = 'lead',
  lead_stage = 'new',
  snooze_until = null
where c.status = 'client'
  and coalesce(c.lead_stage, '') is distinct from 'won'
  and not exists (
    select 1
    from public.deals d
    where d.contact_id = c.id
      and d.stage in ('closed_won', 'won')
  );

update public.contacts c
set
  status = 'client',
  lead_stage = 'won',
  snooze_until = '2099-12-31 00:00:00+00'::timestamptz
where c.lead_stage = 'won'
  and c.status is distinct from 'client';

do $$
declare
  rec record;
begin
  for rec in
    select id from public.contacts
  loop
    perform public.sync_contact_membership(rec.id);
  end loop;
end;
$$;
