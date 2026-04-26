-- Rename legacy CRM table `sales` to `organization_members` and FK columns `sales_id` to `organization_member_id`.
-- Keeps behavior: one row per login user, tenant via org_id, RLS and platform operator policies.

drop view if exists public.contacts_summary;
drop view if exists public.init_state;

drop trigger if exists set_task_sales_id_trigger on public.tasks;
drop trigger if exists set_contact_sales_id_trigger on public.contacts;
drop trigger if exists set_contact_notes_sales_id_trigger on public.contact_notes;
drop trigger if exists set_company_sales_id_trigger on public.companies;
drop trigger if exists set_deal_sales_id_trigger on public.deals;
drop trigger if exists set_deal_notes_sales_id_trigger on public.deal_notes;

drop function if exists public.set_sales_id_default() cascade;

alter table public.companies rename column sales_id to organization_member_id;
alter table public.contacts rename column sales_id to organization_member_id;
alter table public.contact_notes rename column sales_id to organization_member_id;
alter table public.deal_notes rename column sales_id to organization_member_id;
alter table public.deals rename column sales_id to organization_member_id;
alter table public.tasks rename column sales_id to organization_member_id;

alter table public.sales rename to organization_members;

alter table public.organization_members
  rename constraint sales_pkey to organization_members_pkey;

alter index if exists public.uq__sales__user_id rename to uq__organization_members__user_id;
alter index if exists public.sales_one_administrator_per_org_idx
  rename to organization_members_one_administrator_per_org_idx;

-- Session org: replace immediately so nothing references the dropped name `sales`
create or replace function public.current_user_org_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select s.org_id from public.organization_members s where s.user_id = auth.uid() limit 1;
$$;

-- Admins
create or replace function public.is_admin()
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  return exists (
    select 1 from public.organization_members where user_id = auth.uid() and administrator = true
  );
end;
$$;

create or replace function public.current_user_is_administrator()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.organization_members
    where user_id = auth.uid()
      and administrator = true
  );
$$;

create or replace function public.current_user_has_any_role(expected_roles text[])
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.organization_members
    where user_id = auth.uid()
      and (
        administrator = true
        or coalesce(roles, '{}') && expected_roles
      )
  );
$$;

-- RLS: same rules, explicit policy names
drop policy if exists "sales_select_platform" on public.organization_members;
drop policy if exists "sales_select_same_org" on public.organization_members;
drop policy if exists "sales_update_same_org" on public.organization_members;

create policy "organization_members_select_platform" on public.organization_members
  for select to authenticated
  using (public.is_platform_operator());

create policy "organization_members_select_same_org" on public.organization_members
  for select to authenticated
  using (org_id = public.current_user_org_id());

create policy "organization_members_update_same_org" on public.organization_members
  for update to authenticated
  using (org_id = public.current_user_org_id())
  with check (org_id = public.current_user_org_id());

-- Auth: new user row + org
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company text;
  v_meta_org text;
  v_org_id bigint;
  v_in_org int;
  v_first text;
  v_last text;
  v_default_org_name text;
begin
  v_first := coalesce(
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data -> 'custom_claims' ->> 'first_name',
    'Pending'
  );
  v_last := coalesce(
    new.raw_user_meta_data ->> 'last_name',
    new.raw_user_meta_data -> 'custom_claims' ->> 'last_name',
    'Pending'
  );
  v_company := trim(coalesce(new.raw_user_meta_data ->> 'company_name', ''));
  v_meta_org := new.raw_user_meta_data ->> 'org_id';

  if length(v_company) > 0 then
    insert into public.organizations (name) values (v_company) returning id into v_org_id;
    insert into public.organization_members (first_name, last_name, email, user_id, administrator, org_id)
    values (v_first, v_last, new.email, new.id, true, v_org_id);
    return new;
  end if;

  if v_meta_org is not null and v_meta_org ~ '^[0-9]+$' then
    v_org_id := (v_meta_org)::bigint;
  else
    v_default_org_name := coalesce(
      nullif(trim(concat_ws(' ', v_first, v_last)), ''),
      trim(initcap(replace(split_part(new.email, '@', 1), '.', ' ')))
    ) || ' - Workspace';
    insert into public.organizations (name)
    values (v_default_org_name)
    returning id into v_org_id;
  end if;

  select count(*)::int into v_in_org
  from public.organization_members
  where org_id = v_org_id;

  insert into public.organization_members (first_name, last_name, email, user_id, administrator, org_id)
  values (
    v_first,
    v_last,
    new.email,
    new.id,
    case when v_in_org = 0 then true else false end,
    v_org_id
  );
  return new;
end;
$$;
create or replace function public.handle_update_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update public.organization_members
  set
    first_name = coalesce(new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data -> 'custom_claims' ->> 'first_name', 'Pending'),
    last_name = coalesce(new.raw_user_meta_data ->> 'last_name', new.raw_user_meta_data -> 'custom_claims' ->> 'last_name', 'Pending'),
    email = new.email
  where user_id = new.id;

  return new;
end;
$function$;
create or replace function public.set_organization_member_id_default()
returns trigger
language plpgsql
as $$
begin
  if new.organization_member_id is null then
    select id into new.organization_member_id from public.organization_members where user_id = auth.uid();
  end if;
  return new;
end;
$$;

create trigger set_task_organization_member_id_trigger
  before insert on public.tasks
  for each row
  execute function public.set_organization_member_id_default();

create trigger set_contact_organization_member_id_trigger
  before insert on public.contacts
  for each row
  execute function public.set_organization_member_id_default();

create trigger set_contact_notes_organization_member_id_trigger
  before insert on public.contact_notes
  for each row
  execute function public.set_organization_member_id_default();

create trigger set_company_organization_member_id_trigger
  before insert on public.companies
  for each row
  execute function public.set_organization_member_id_default();

create trigger set_deal_organization_member_id_trigger
  before insert on public.deals
  for each row
  execute function public.set_organization_member_id_default();

create trigger set_deal_notes_organization_member_id_trigger
  before insert on public.deal_notes
  for each row
  execute function public.set_organization_member_id_default();
create or replace view public.init_state
  with (security_invoker=off)
  as
select count(id) as is_initialized
from (
  select id
  from public.organization_members
  limit 1
) as sub;
create view public.contacts_summary
with (security_invoker = true)
as
select
  co.id,
  co.first_name,
  co.last_name,
  co.gender,
  co.title,
  co.email_jsonb,
  jsonb_path_query_array(co.email_jsonb, '$[*].email')::text as email_fts,
  co.phone_jsonb,
  jsonb_path_query_array(co.phone_jsonb, '$[*].number')::text as phone_fts,
  co.background,
  co.address,
  co.avatar,
  co.first_seen,
  co.last_seen,
  co.has_newsletter,
  co.status,
  co.tags,
  co.company_id,
  co.organization_member_id,
  co.linkedin_url,
  c.name as company_name,
  count(distinct t.id) as nb_tasks
from public.contacts co
left join public.tasks t on co.id = t.contact_id
left join public.companies c on co.company_id = c.id
group by co.id, c.name;

grant select on public.contacts_summary to authenticated;
grant select on public.contacts_summary to service_role;
-- merge_contacts: attribute ownership column renamed
create or replace function merge_contacts(loser_id bigint, winner_id bigint)
returns bigint
language plpgsql
security invoker
as $merge$
declare
  winner_contact contacts%ROWTYPE;
  loser_contact contacts%ROWTYPE;
  deal_record record;
  merged_emails jsonb;
  merged_phones jsonb;
  merged_tags bigint[];
  winner_emails jsonb;
  loser_emails jsonb;
  winner_phones jsonb;
  loser_phones jsonb;
  email_map jsonb;
  phone_map jsonb;
begin
  select * into winner_contact from contacts where id = winner_id;
  select * into loser_contact from contacts where id = loser_id;

  if winner_contact is null or loser_contact is null then
    raise exception 'Contact not found';
  end if;

  update tasks set contact_id = winner_id where contact_id = loser_id;
  update "contact_notes" set contact_id = winner_id where contact_id = loser_id;

  for deal_record in
    select id, contact_ids
    from deals
    where contact_ids @> array[loser_id]
  loop
    update deals
    set contact_ids = (
      select array(
        select distinct unnest(
          array_remove(deal_record.contact_ids, loser_id) || array[winner_id]
        )
      )
    )
    where id = deal_record.id;
  end loop;

  winner_emails := coalesce(winner_contact.email_jsonb, '[]'::jsonb);
  loser_emails := coalesce(loser_contact.email_jsonb, '[]'::jsonb);
  email_map := '{}'::jsonb;

  if jsonb_array_length(winner_emails) > 0 then
    for i in 0..jsonb_array_length(winner_emails)-1 loop
      email_map := email_map || jsonb_build_object(
        winner_emails->i->>'email',
        winner_emails->i
      );
    end loop;
  end if;

  if jsonb_array_length(loser_emails) > 0 then
    for i in 0..jsonb_array_length(loser_emails)-1 loop
      if not email_map ? (loser_emails->i->>'email') then
        email_map := email_map || jsonb_build_object(
          loser_emails->i->>'email',
          loser_emails->i
        );
      end if;
    end loop;
  end if;

  merged_emails := (select jsonb_agg(value) from jsonb_each(email_map));
  merged_emails := coalesce(merged_emails, '[]'::jsonb);

  winner_phones := coalesce(winner_contact.phone_jsonb, '[]'::jsonb);
  loser_phones := coalesce(loser_contact.phone_jsonb, '[]'::jsonb);
  phone_map := '{}'::jsonb;

  if jsonb_array_length(winner_phones) > 0 then
    for i in 0..jsonb_array_length(winner_phones)-1 loop
      phone_map := phone_map || jsonb_build_object(
        winner_phones->i->>'number',
        winner_phones->i
      );
    end loop;
  end if;

  if jsonb_array_length(loser_phones) > 0 then
    for i in 0..jsonb_array_length(loser_phones)-1 loop
      if not phone_map ? (loser_phones->i->>'number') then
        phone_map := phone_map || jsonb_build_object(
          loser_phones->i->>'number',
          loser_phones->i
        );
      end if;
    end loop;
  end if;

  merged_phones := (select jsonb_agg(value) from jsonb_each(phone_map));
  merged_phones := coalesce(merged_phones, '[]'::jsonb);

  merged_tags := array(
    select distinct unnest(
      coalesce(winner_contact.tags, array[]::bigint[]) ||
      coalesce(loser_contact.tags, array[]::bigint[])
    )
  );

  update contacts set
    avatar = coalesce(winner_contact.avatar, loser_contact.avatar),
    gender = coalesce(winner_contact.gender, loser_contact.gender),
    first_name = coalesce(winner_contact.first_name, loser_contact.first_name),
    last_name = coalesce(winner_contact.last_name, loser_contact.last_name),
    title = coalesce(winner_contact.title, loser_contact.title),
    company_id = coalesce(winner_contact.company_id, loser_contact.company_id),
    email_jsonb = merged_emails,
    phone_jsonb = merged_phones,
    linkedin_url = coalesce(winner_contact.linkedin_url, loser_contact.linkedin_url),
    background = coalesce(winner_contact.background, loser_contact.background),
    has_newsletter = coalesce(winner_contact.has_newsletter, loser_contact.has_newsletter),
    first_seen = least(coalesce(winner_contact.first_seen, loser_contact.first_seen), coalesce(loser_contact.first_seen, winner_contact.first_seen)),
    last_seen = greatest(coalesce(winner_contact.last_seen, loser_contact.last_seen), coalesce(loser_contact.last_seen, winner_contact.last_seen)),
    organization_member_id = coalesce(winner_contact.organization_member_id, loser_contact.organization_member_id),
    tags = merged_tags
  where id = winner_id;

  delete from contacts where id = loser_id;
  return winner_id;
end;
$merge$;

create or replace function public.generate_payment_lines(p_payment_id bigint)
returns integer
language plpgsql
security invoker
as $$
declare
  v_payment public.payments%rowtype;
  v_run public.payroll_runs%rowtype;
  v_inserted integer := 0;
  v_rowcount integer := 0;
  v_days_in_period integer := 0;
  v_has_run_scope boolean := false;
  v_employee_ids bigint[] := '{}'::bigint[];
begin
  select * into v_payment from public.payments where id = p_payment_id;
  if v_payment is null then
    raise exception 'Payment % not found', p_payment_id;
  end if;

  if v_payment.status = 'paid' then
    raise exception 'Payment % cannot be regenerated in status paid', p_payment_id;
  end if;

  if coalesce(v_payment.category, 'mixed') = 'sales_commissions'
     and v_payment.payroll_run_id is not null then
    raise exception 'Payment % with category sales_commissions cannot be linked to a payroll_run_id', p_payment_id;
  end if;

  if v_payment.payroll_run_id is not null then
    select * into v_run from public.payroll_runs where id = v_payment.payroll_run_id;
    if v_run is null then
      raise exception 'Payroll run % not found for payment %', v_payment.payroll_run_id, p_payment_id;
    end if;
    v_has_run_scope := true;

    select coalesce(array_agg(distinct prl.employee_id), '{}'::bigint[])
      into v_employee_ids
    from public.payroll_run_lines prl
    where prl.payroll_run_id = v_run.id;

    if array_length(v_employee_ids, 1) is null and v_run.employee_id is not null then
      v_employee_ids := array[v_run.employee_id];
    end if;
  end if;

  -- Regeneration cleanup:
  -- Remove previous links created by this payment and restore entry state
  -- before rebuilding payment lines deterministically.
  update public.time_entries te
  set
    payment_run_id = null,
    included_in_payroll = case
      when te.payroll_run_id is not null then true
      else false
    end,
    status = case
      when te.status = 'paid' then
        case
          when te.payroll_run_id is not null then 'included_in_payroll'
          else 'approved'
        end
      when te.status = 'included_in_payroll' and te.payroll_run_id is null then 'approved'
      else te.status
    end
  where te.payment_run_id = v_payment.id;

  delete from public.payment_lines
  where payment_id = v_payment.id;

  v_days_in_period := greatest(1, (v_payment.pay_period_end - v_payment.pay_period_start + 1));

  if coalesce(v_payment.category, 'mixed') in ('hourly', 'mixed') then
    insert into public.payment_lines (
      payment_id,
      person_id,
      project_id,
      compensation_type,
      compensation_unit,
      compensation_amount,
      source_type,
      source_id,
      source_reference,
      qty_hours,
      regular_hours,
      overtime_hours,
      rate,
      regular_pay,
      overtime_pay,
      bonuses,
      deductions,
      total_pay,
      amount,
      notes
    )
    select
      v_payment.id,
      te.person_id,
      te.project_id,
      case
        when coalesce(p.compensation_unit, 'hour') = 'day' then 'daily'
        else 'hourly'
      end,
      coalesce(p.compensation_unit, 'hour'),
      coalesce(
        p.compensation_amount,
        case when coalesce(p.compensation_unit, 'hour') = 'day' then p.day_rate else p.hourly_rate end
      ),
      'time_entry',
      te.id,
      concat('time_entry:', te.id),
      coalesce(te.payable_hours, te.hours, 0),
      coalesce(te.regular_hours, least(coalesce(te.payable_hours, te.hours, 0), 8)),
      coalesce(te.overtime_hours, greatest(coalesce(te.payable_hours, te.hours, 0) - 8, 0)),
      case
        when coalesce(p.compensation_unit, 'hour') = 'day'
          then coalesce(p.day_rate, p.compensation_amount, 0) / greatest(1, coalesce(p.paid_day_hours, 8))
        else coalesce(p.hourly_rate, p.compensation_amount, 0)
      end,
      round(
        coalesce(te.regular_hours, least(coalesce(te.payable_hours, te.hours, 0), 8))
        * (
          case
            when coalesce(p.compensation_unit, 'hour') = 'day'
              then coalesce(p.day_rate, p.compensation_amount, 0) / greatest(1, coalesce(p.paid_day_hours, 8))
            else coalesce(p.hourly_rate, p.compensation_amount, 0)
          end
        ),
        2
      ),
      round(
        coalesce(te.overtime_hours, greatest(coalesce(te.payable_hours, te.hours, 0) - 8, 0))
        * (
          case
            when coalesce(p.compensation_unit, 'hour') = 'day'
              then coalesce(p.day_rate, p.compensation_amount, 0) / greatest(1, coalesce(p.paid_day_hours, 8))
            else coalesce(p.hourly_rate, p.compensation_amount, 0)
          end
        )
        * case when coalesce(p.overtime_enabled, false) then coalesce(p.overtime_rate_multiplier, 1.5) else 1 end,
        2
      ),
      0,
      0,
      round(
        (
          coalesce(te.regular_hours, least(coalesce(te.payable_hours, te.hours, 0), 8))
          * (
            case
              when coalesce(p.compensation_unit, 'hour') = 'day'
                then coalesce(p.day_rate, p.compensation_amount, 0) / greatest(1, coalesce(p.paid_day_hours, 8))
              else coalesce(p.hourly_rate, p.compensation_amount, 0)
            end
          )
        ) + (
          coalesce(te.overtime_hours, greatest(coalesce(te.payable_hours, te.hours, 0) - 8, 0))
          * (
            case
              when coalesce(p.compensation_unit, 'hour') = 'day'
                then coalesce(p.day_rate, p.compensation_amount, 0) / greatest(1, coalesce(p.paid_day_hours, 8))
              else coalesce(p.hourly_rate, p.compensation_amount, 0)
            end
          )
          * case when coalesce(p.overtime_enabled, false) then coalesce(p.overtime_rate_multiplier, 1.5) else 1 end
        ),
        2
      ),
      round(
        (
          coalesce(te.regular_hours, least(coalesce(te.payable_hours, te.hours, 0), 8))
          * (
            case
              when coalesce(p.compensation_unit, 'hour') = 'day'
                then coalesce(p.day_rate, p.compensation_amount, 0) / greatest(1, coalesce(p.paid_day_hours, 8))
              else coalesce(p.hourly_rate, p.compensation_amount, 0)
            end
          )
        ) + (
          coalesce(te.overtime_hours, greatest(coalesce(te.payable_hours, te.hours, 0) - 8, 0))
          * (
            case
              when coalesce(p.compensation_unit, 'hour') = 'day'
                then coalesce(p.day_rate, p.compensation_amount, 0) / greatest(1, coalesce(p.paid_day_hours, 8))
              else coalesce(p.hourly_rate, p.compensation_amount, 0)
            end
          )
          * case when coalesce(p.overtime_enabled, false) then coalesce(p.overtime_rate_multiplier, 1.5) else 1 end
        ),
        2
      ),
      concat('Generated from time entry #', te.id)
    from public.time_entries te
    inner join public.people p on p.id = te.person_id
    where te.org_id = v_payment.org_id
      and p.org_id = v_payment.org_id
      and (
        coalesce(p.compensation_unit, 'hour') in ('hour', 'day')
        or p.compensation_type in ('hourly', 'daily')
      )
      and (
        (v_has_run_scope and te.payroll_run_id = v_run.id and te.status in ('approved', 'included_in_payroll', 'paid'))
        or
        (
          not v_has_run_scope
          and te.status = 'approved'
          and te.date between v_payment.pay_period_start and v_payment.pay_period_end
        )
      )
      and (not v_has_run_scope or te.person_id = any(v_employee_ids))
      ;

    get diagnostics v_rowcount = row_count;
    v_inserted := v_inserted + v_rowcount;
  end if;

  if coalesce(v_payment.category, 'mixed') in ('salaried', 'mixed') then
    insert into public.payment_lines (
      payment_id,
      person_id,
      project_id,
      compensation_type,
      compensation_unit,
      compensation_amount,
      source_type,
      source_id,
      source_reference,
      qty_hours,
      regular_hours,
      overtime_hours,
      rate,
      regular_pay,
      overtime_pay,
      bonuses,
      deductions,
      total_pay,
      amount,
      notes
    )
    select
      v_payment.id,
      p.id,
      null,
      p.compensation_type,
      coalesce(
        p.compensation_unit,
        case
          when p.compensation_type = 'weekly_salary' then 'week'
          when p.compensation_type = 'monthly_salary' then 'month'
          else null
        end
      ),
      coalesce(
        p.compensation_amount,
        case
          when p.compensation_type = 'weekly_salary' then p.weekly_salary_amount
          when p.compensation_type = 'monthly_salary' then p.monthly_salary_amount
          when p.compensation_type = 'fixed_salary' then p.fixed_salary_amount
          else null
        end
      ),
      'salary',
      p.id,
      concat('salary:', p.id, ':', v_payment.id),
      null,
      null,
      null,
      null,
      round(
        case
          when p.compensation_type = 'weekly_salary' then coalesce(p.weekly_salary_amount, 0) * (v_days_in_period::numeric / 7)
          when p.compensation_type = 'monthly_salary' then
            coalesce(p.monthly_salary_amount, 0)
            * (v_days_in_period::numeric / extract(day from (date_trunc('month', v_payment.pay_period_start) + interval '1 month - 1 day')))
          when p.compensation_type = 'fixed_salary' then coalesce(p.fixed_salary_amount, 0)
          else 0
        end,
        2
      ),
      0,
      0,
      0,
      round(
        case
          when p.compensation_type = 'weekly_salary' then coalesce(p.weekly_salary_amount, 0) * (v_days_in_period::numeric / 7)
          when p.compensation_type = 'monthly_salary' then
            coalesce(p.monthly_salary_amount, 0)
            * (v_days_in_period::numeric / extract(day from (date_trunc('month', v_payment.pay_period_start) + interval '1 month - 1 day')))
          when p.compensation_type = 'fixed_salary' then coalesce(p.fixed_salary_amount, 0)
          else 0
        end,
        2
      ),
      round(
        case
          when p.compensation_type = 'weekly_salary' then coalesce(p.weekly_salary_amount, 0) * (v_days_in_period::numeric / 7)
          when p.compensation_type = 'monthly_salary' then
            coalesce(p.monthly_salary_amount, 0)
            * (v_days_in_period::numeric / extract(day from (date_trunc('month', v_payment.pay_period_start) + interval '1 month - 1 day')))
          when p.compensation_type = 'fixed_salary' then coalesce(p.fixed_salary_amount, 0)
          else 0
        end,
        2
      ),
      'Generated salaried base line'
    from public.people p
    where p.org_id = v_payment.org_id
      and p.status = 'active'
      and p.compensation_type in ('weekly_salary', 'monthly_salary', 'fixed_salary')
      and (not v_has_run_scope or p.id = any(v_employee_ids))
      ;

    get diagnostics v_rowcount = row_count;
    v_inserted := v_inserted + v_rowcount;
  end if;

  if coalesce(v_payment.category, 'mixed') in ('sales_commissions', 'mixed')
     and not v_has_run_scope then
    insert into public.payment_lines (
      payment_id,
      person_id,
      project_id,
      compensation_type,
      compensation_unit,
      compensation_amount,
      source_type,
      source_id,
      source_reference,
      qty_hours,
      regular_hours,
      overtime_hours,
      rate,
      regular_pay,
      overtime_pay,
      bonuses,
      deductions,
      total_pay,
      amount,
      notes
    )
    select
      v_payment.id,
      p.id,
      d.id,
      'commission',
      'commission',
      p.commission_rate,
      'commission',
      d.id,
      concat('commission:deal:', d.id),
      null,
      null,
      null,
      p.commission_rate,
      round((coalesce(d.amount, 0)::numeric * coalesce(p.commission_rate, 0)) / 100, 2),
      0,
      0,
      0,
      round((coalesce(d.amount, 0)::numeric * coalesce(p.commission_rate, 0)) / 100, 2),
      round((coalesce(d.amount, 0)::numeric * coalesce(p.commission_rate, 0)) / 100, 2),
      concat('Generated commission from project #', d.id)
    from public.deals d
    cross join lateral (
      select distinct sid::bigint as salesperson_id
      from unnest(
        case
          when d.salesperson_ids is null then array[d.organization_member_id]
          else array_append(d.salesperson_ids, d.organization_member_id)
        end
      ) sid
      where sid is not null
    ) sales_scope
    inner join public.people p on p.id = sales_scope.salesperson_id
    where p.type = 'salesperson'
      and p.org_id = v_payment.org_id
      and d.stage = 'won'
      and coalesce(d.expected_closing_date::date, d.created_at::date)
          between v_payment.pay_period_start and v_payment.pay_period_end
      and (not v_has_run_scope or p.id = any(v_employee_ids))
      ;

    get diagnostics v_rowcount = row_count;
    v_inserted := v_inserted + v_rowcount;
  end if;

  update public.payments py
  set
    total_gross = coalesce((
      select round(coalesce(sum(coalesce(pl.total_pay, pl.amount)), 0), 2)
      from public.payment_lines pl
      where pl.payment_id = v_payment.id
    ), 0),
    total_net = coalesce((
      select round(coalesce(sum(coalesce(pl.total_pay, pl.amount)), 0), 2)
      from public.payment_lines pl
      where pl.payment_id = v_payment.id
    ), 0)
  where py.id = v_payment.id;

  if v_has_run_scope then
    update public.time_entries te
    set included_in_payroll = true,
        payment_run_id = v_payment.id,
        status = case
          when te.status = 'approved' then 'included_in_payroll'
          else te.status
        end
    where te.payroll_run_id = v_run.id
      and te.id in (
        select pl.source_id
        from public.payment_lines pl
        where pl.payment_id = v_payment.id
          and pl.source_type = 'time_entry'
          and pl.source_id is not null
      );
  else
    update public.time_entries te
    set included_in_payroll = true,
        payment_run_id = v_payment.id,
        status = case
          when te.status = 'approved' then 'included_in_payroll'
          else te.status
        end
    where te.id in (
      select pl.source_id
      from public.payment_lines pl
      where pl.payment_id = v_payment.id
        and pl.source_type = 'time_entry'
        and pl.source_id is not null
    );
  end if;

  return v_inserted;
end;
$$;

create or replace function public.validate_payment_line_source_integrity()
returns trigger
language plpgsql
as $val$
declare
  v_payment public.payments%rowtype;
  v_person public.people%rowtype;
  v_time_entry public.time_entries%rowtype;
  v_deal public.deals%rowtype;
begin
  select * into v_payment from public.payments where id = new.payment_id;
  if v_payment is null then
    raise exception 'Payment % not found for payment_line', new.payment_id;
  end if;

  if new.source_type in ('time_entry', 'salary', 'commission') then
    if new.source_id is null then
      raise exception 'payment_lines.source_id is required for source_type %', new.source_type;
    end if;
    if new.person_id is null then
      raise exception 'payment_lines.person_id is required for source_type %', new.source_type;
    end if;
  elsif new.source_type = 'adjustment' then
    if new.source_id is not null then
      raise exception 'payment_lines.source_id must be null for source_type adjustment';
    end if;
  end if;

  if new.person_id is not null then
    select * into v_person from public.people where id = new.person_id;
    if v_person is null then
      raise exception 'Person % not found for payment_line', new.person_id;
    end if;
    if v_person.org_id is distinct from v_payment.org_id then
      raise exception 'payment_lines person org mismatch for line % (person.org_id %, payment.org_id %)',
        coalesce(new.id, 0), v_person.org_id, v_payment.org_id;
    end if;
  end if;

  if new.source_type = 'time_entry' then
    select * into v_time_entry from public.time_entries where id = new.source_id;
    if v_time_entry is null then
      raise exception 'Time entry % not found for payment_line', new.source_id;
    end if;
    if v_time_entry.person_id is distinct from new.person_id then
      raise exception 'payment_lines person_id must match time_entries.person_id for source_id %', new.source_id;
    end if;
    if v_time_entry.org_id is distinct from v_payment.org_id then
      raise exception 'payment_lines time_entry org mismatch for source_id %', new.source_id;
    end if;
    if new.project_id is null then
      new.project_id := v_time_entry.project_id;
    elsif v_time_entry.project_id is distinct from new.project_id then
      raise exception 'payment_lines project_id must match time_entries.project_id for source_id %', new.source_id;
    end if;
  elsif new.source_type = 'salary' then
    if new.source_id is distinct from new.person_id then
      raise exception 'payment_lines salary source_id must equal person_id';
    end if;
  elsif new.source_type = 'commission' then
    select * into v_deal from public.deals where id = new.source_id;
    if v_deal is null then
      raise exception 'Deal % not found for commission payment_line', new.source_id;
    end if;
    if v_deal.organization_member_id is distinct from new.person_id
      and not (v_deal.salesperson_ids is not null and new.person_id = any(v_deal.salesperson_ids)) then
      raise exception 'payment_lines commission person % is not assigned as salesperson on deal %',
        new.person_id,
        v_deal.id;
    end if;
    if new.project_id is null then
      new.project_id := v_deal.id;
    elsif new.project_id is distinct from v_deal.id then
      raise exception 'payment_lines commission project_id must equal deal id (source_id)';
    end if;
  end if;
  return new;
end;
$val$;
