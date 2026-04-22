-- Payroll restructure: compensation profiles, richer time entries, and payment run metadata

alter table public.people
  add column if not exists compensation_type text,
  add column if not exists weekly_salary_amount numeric(12,2),
  add column if not exists monthly_salary_amount numeric(12,2),
  add column if not exists fixed_salary_amount numeric(12,2),
  add column if not exists overtime_enabled boolean not null default false,
  add column if not exists overtime_rate_multiplier numeric(6,3) not null default 1.5,
  add column if not exists pay_schedule text,
  add column if not exists default_hours_per_week numeric(6,2) default 40,
  add column if not exists default_work_days integer[] default array[1,2,3,4,5];

update public.people
set compensation_type = case
  when compensation_type is not null then compensation_type
  when pay_type = 'hourly' then 'hourly'
  when pay_type = 'day_rate' then 'hourly'
  when pay_type = 'commission' then 'commission'
  when pay_type = 'salary' then 'fixed_salary'
  else 'hourly'
end;

update public.people
set hourly_rate = coalesce(hourly_rate, round(coalesce(day_rate, 0) / 8.0, 2))
where pay_type = 'day_rate';

update public.people
set fixed_salary_amount = coalesce(fixed_salary_amount, salary_rate)
where pay_type = 'salary';

update public.people
set pay_schedule = coalesce(pay_schedule, 'biweekly');

alter table public.people
  drop constraint if exists people_compensation_type_check;

alter table public.people
  add constraint people_compensation_type_check
  check (compensation_type in ('hourly', 'weekly_salary', 'monthly_salary', 'fixed_salary', 'commission'));

alter table public.people
  drop constraint if exists people_pay_schedule_check;

alter table public.people
  add constraint people_pay_schedule_check
  check (pay_schedule in ('weekly', 'biweekly', 'semi_monthly', 'monthly'));

alter table public.time_entries
  add column if not exists break_minutes integer not null default 0,
  add column if not exists regular_hours numeric(8,2),
  add column if not exists overtime_hours numeric(8,2),
  add column if not exists work_location text,
  add column if not exists work_type text,
  add column if not exists internal_notes text,
  add column if not exists submitted_at timestamp with time zone,
  add column if not exists approved_by text,
  add column if not exists approved_at timestamp with time zone,
  add column if not exists rejected_at timestamp with time zone,
  add column if not exists rejected_reason text,
  add column if not exists included_in_payroll boolean not null default false,
  add column if not exists payment_run_id bigint references public.payments(id) on update cascade on delete set null;

update public.time_entries
set regular_hours = coalesce(regular_hours, least(coalesce(hours, 0), 8)),
    overtime_hours = coalesce(overtime_hours, greatest(coalesce(hours, 0) - 8, 0));

alter table public.time_entries
  drop constraint if exists time_entries_status_check;

alter table public.time_entries
  add constraint time_entries_status_check
  check (status in ('draft', 'submitted', 'approved', 'rejected', 'paid'));

alter table public.payments
  add column if not exists run_name text,
  add column if not exists category text,
  add column if not exists notes text,
  add column if not exists created_by text,
  add column if not exists approved_at timestamp with time zone,
  add column if not exists paid_at timestamp with time zone;

alter table public.payments
  drop constraint if exists payments_category_check;

alter table public.payments
  add constraint payments_category_check
  check (category in ('hourly', 'salaried', 'subcontractor', 'sales_commissions', 'mixed'));

update public.payments
set category = coalesce(category, 'mixed'),
    run_name = coalesce(run_name, concat('Payroll Run #', id));

alter table public.payment_lines
  add column if not exists compensation_type text,
  add column if not exists source_reference text,
  add column if not exists regular_hours numeric(8,2),
  add column if not exists overtime_hours numeric(8,2),
  add column if not exists regular_pay numeric(14,2),
  add column if not exists overtime_pay numeric(14,2),
  add column if not exists bonuses numeric(14,2) default 0,
  add column if not exists deductions numeric(14,2) default 0,
  add column if not exists total_pay numeric(14,2);

update public.payment_lines pl
set compensation_type = coalesce(pl.compensation_type, p.compensation_type),
    regular_hours = coalesce(pl.regular_hours, least(coalesce(pl.qty_hours, 0), 8)),
    overtime_hours = coalesce(pl.overtime_hours, greatest(coalesce(pl.qty_hours, 0) - 8, 0)),
    regular_pay = coalesce(pl.regular_pay, round(least(coalesce(pl.qty_hours, 0), 8) * coalesce(pl.rate, 0), 2)),
    overtime_pay = coalesce(pl.overtime_pay, round(greatest(coalesce(pl.qty_hours, 0) - 8, 0) * coalesce(pl.rate, 0), 2)),
    total_pay = coalesce(pl.total_pay, pl.amount)
from public.people p
where p.id = pl.person_id;

alter table public.payment_lines
  drop constraint if exists payment_lines_compensation_type_check;

alter table public.payment_lines
  add constraint payment_lines_compensation_type_check
  check (compensation_type in ('hourly', 'weekly_salary', 'monthly_salary', 'fixed_salary', 'commission'));

create or replace function public.generate_payment_lines(p_payment_id bigint)
returns integer
language plpgsql
security invoker
as $$
declare
  v_payment public.payments%rowtype;
  v_inserted integer := 0;
  v_rowcount integer := 0;
  v_days_in_period integer := 0;
begin
  select * into v_payment from public.payments where id = p_payment_id;
  if v_payment is null then
    raise exception 'Payment % not found', p_payment_id;
  end if;

  v_days_in_period := greatest(1, (v_payment.pay_period_end - v_payment.pay_period_start + 1));

  -- Hourly time entry lines
  if coalesce(v_payment.category, 'mixed') in ('hourly', 'mixed') then
    insert into public.payment_lines (
      payment_id,
      person_id,
      project_id,
      compensation_type,
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
      'hourly',
      'time_entry',
      te.id,
      concat('time_entry:', te.id),
      te.hours,
      coalesce(te.regular_hours, least(te.hours, 8)),
      coalesce(te.overtime_hours, greatest(te.hours - 8, 0)),
      coalesce(p.hourly_rate, 0),
      round(coalesce(te.regular_hours, least(te.hours, 8)) * coalesce(p.hourly_rate, 0), 2),
      round(
        coalesce(te.overtime_hours, greatest(te.hours - 8, 0))
        * coalesce(p.hourly_rate, 0)
        * case when coalesce(p.overtime_enabled, false) then coalesce(p.overtime_rate_multiplier, 1.5) else 1 end,
        2
      ),
      0,
      0,
      round(
        coalesce(te.regular_hours, least(te.hours, 8)) * coalesce(p.hourly_rate, 0)
        + coalesce(te.overtime_hours, greatest(te.hours - 8, 0))
          * coalesce(p.hourly_rate, 0)
          * case when coalesce(p.overtime_enabled, false) then coalesce(p.overtime_rate_multiplier, 1.5) else 1 end,
        2
      ),
      round(
        coalesce(te.regular_hours, least(te.hours, 8)) * coalesce(p.hourly_rate, 0)
        + coalesce(te.overtime_hours, greatest(te.hours - 8, 0))
          * coalesce(p.hourly_rate, 0)
          * case when coalesce(p.overtime_enabled, false) then coalesce(p.overtime_rate_multiplier, 1.5) else 1 end,
        2
      ),
      concat('Generated from approved time entry #', te.id)
    from public.time_entries te
    inner join public.people p on p.id = te.person_id
    where te.org_id = v_payment.org_id
      and p.org_id = v_payment.org_id
      and p.compensation_type = 'hourly'
      and te.status = 'approved'
      and te.date between v_payment.pay_period_start and v_payment.pay_period_end
      and not exists (
        select 1
        from public.payment_lines pl
        where pl.source_type = 'time_entry'
          and pl.source_id = te.id
      );

    get diagnostics v_rowcount = row_count;
    v_inserted := v_inserted + v_rowcount;
  end if;

  -- Salaried lines (weekly, monthly, fixed)
  if coalesce(v_payment.category, 'mixed') in ('salaried', 'mixed') then
    insert into public.payment_lines (
      payment_id,
      person_id,
      project_id,
      compensation_type,
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
      and not exists (
        select 1
        from public.payment_lines pl
        where pl.payment_id = v_payment.id
          and pl.person_id = p.id
          and pl.source_type = 'salary'
      );

    get diagnostics v_rowcount = row_count;
    v_inserted := v_inserted + v_rowcount;
  end if;

  -- Sales commissions
  if coalesce(v_payment.category, 'mixed') in ('sales_commissions', 'mixed') then
    insert into public.payment_lines (
      payment_id,
      person_id,
      project_id,
      compensation_type,
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
    inner join public.people p on p.id = d.sales_id
    where p.type = 'salesperson'
      and p.org_id = v_payment.org_id
      and d.stage = 'won'
      and coalesce(d.expected_closing_date::date, d.created_at::date)
          between v_payment.pay_period_start and v_payment.pay_period_end
      and not exists (
        select 1
        from public.payment_lines pl
        where pl.source_type = 'commission'
          and pl.source_id = d.id
          and pl.person_id = p.id
      );

    get diagnostics v_rowcount = row_count;
    v_inserted := v_inserted + v_rowcount;
  end if;

  update public.payments py
  set total_gross = lines.total_gross,
      total_net = lines.total_gross
  from (
    select payment_id, round(coalesce(sum(coalesce(total_pay, amount)), 0), 2) as total_gross
    from public.payment_lines
    where payment_id = v_payment.id
    group by payment_id
  ) lines
  where py.id = lines.payment_id;

  update public.time_entries te
  set included_in_payroll = true,
      payment_run_id = v_payment.id
  where te.id in (
    select pl.source_id
    from public.payment_lines pl
    where pl.payment_id = v_payment.id
      and pl.source_type = 'time_entry'
      and pl.source_id is not null
  );

  return v_inserted;
end;
$$;

create or replace function public.mark_payment_time_entries_paid()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    update public.time_entries te
    set status = 'paid',
        included_in_payroll = true,
        payment_run_id = new.id
    where te.id in (
      select pl.source_id
      from public.payment_lines pl
      where pl.payment_id = new.id
        and pl.source_type = 'time_entry'
        and pl.source_id is not null
    );
  end if;

  return new;
end;
$$;
