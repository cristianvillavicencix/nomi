alter table public.people
  add column if not exists compensation_unit text,
  add column if not exists compensation_amount numeric(12,2);

update public.people
set compensation_unit = coalesce(
      compensation_unit,
      case
        when compensation_type = 'daily' then 'day'
        when compensation_type = 'weekly_salary' then 'week'
        when compensation_type = 'biweekly_salary' then 'week'
        when compensation_type = 'monthly_salary' then 'month'
        when pay_type = 'day_rate' then 'day'
        when pay_type = 'salary' then 'month'
        when pay_type = 'commission' then 'commission'
        else 'hour'
      end
    ),
    compensation_amount = coalesce(
      compensation_amount,
      case
        when compensation_type = 'weekly_salary' then weekly_salary_amount
        when compensation_type = 'biweekly_salary' then round(coalesce(biweekly_salary_amount, 0) / 2.0, 2)
        when compensation_type = 'monthly_salary' then monthly_salary_amount
        when compensation_type = 'daily' then day_rate
        when pay_type = 'day_rate' then day_rate
        when pay_type = 'salary' then coalesce(monthly_salary_amount, salary_rate)
        when pay_type = 'commission' then commission_rate
        else hourly_rate
      end
    );

alter table public.people
  drop constraint if exists people_compensation_unit_check;
alter table public.people
  add constraint people_compensation_unit_check
  check (compensation_unit in ('hour', 'day', 'week', 'month', 'commission'));

alter table public.people
  drop constraint if exists people_compensation_type_check;
alter table public.people
  add constraint people_compensation_type_check
  check (compensation_type in ('hourly', 'daily', 'weekly_salary', 'biweekly_salary', 'monthly_salary', 'fixed_salary', 'commission'));

alter table public.payroll_run_lines
  add column if not exists compensation_unit text,
  add column if not exists compensation_amount numeric(12,2);

update public.payroll_run_lines
set compensation_unit = coalesce(
      compensation_unit,
      case
        when compensation_type = 'daily' then 'day'
        when compensation_type = 'weekly_salary' then 'week'
        when compensation_type = 'biweekly_salary' then 'week'
        when compensation_type = 'monthly_salary' then 'month'
        else 'hour'
      end
    ),
    compensation_amount = coalesce(compensation_amount, base_salary_amount);

alter table public.payroll_run_lines
  drop constraint if exists payroll_run_lines_compensation_type_check;
alter table public.payroll_run_lines
  add constraint payroll_run_lines_compensation_type_check
  check (compensation_type in ('hourly', 'daily', 'weekly_salary', 'biweekly_salary', 'monthly_salary'));

alter table public.payment_lines
  add column if not exists compensation_unit text,
  add column if not exists compensation_amount numeric(12,2);

update public.payment_lines
set compensation_unit = coalesce(
      compensation_unit,
      case
        when compensation_type = 'daily' then 'day'
        when compensation_type = 'weekly_salary' then 'week'
        when compensation_type = 'monthly_salary' then 'month'
        when compensation_type = 'commission' then 'commission'
        else 'hour'
      end
    ),
    compensation_amount = coalesce(compensation_amount, rate, amount);

alter table public.payment_lines
  drop constraint if exists payment_lines_compensation_type_check;
alter table public.payment_lines
  add constraint payment_lines_compensation_type_check
  check (compensation_type in ('hourly', 'daily', 'weekly_salary', 'monthly_salary', 'fixed_salary', 'commission'));

create or replace function public.generate_payroll_run(p_payroll_run_id bigint)
returns integer
language plpgsql
security invoker
as $$
declare
  v_run public.payroll_runs%rowtype;
  v_inserted integer := 0;
  v_rowcount integer := 0;
  v_period_days integer := 0;
begin
  select * into v_run from public.payroll_runs where id = p_payroll_run_id;
  if v_run is null then
    raise exception 'Payroll run % not found', p_payroll_run_id;
  end if;

  v_period_days := greatest(1, (v_run.pay_period_end - v_run.pay_period_start + 1));

  insert into public.payroll_run_lines (
    payroll_run_id,
    employee_id,
    compensation_type,
    compensation_unit,
    compensation_amount,
    payment_method,
    regular_hours,
    overtime_hours,
    paid_leave_hours,
    base_salary_amount,
    unpaid_absence_deduction,
    gross_pay,
    total_deductions,
    net_pay,
    payment_notes
  )
  select
    v_run.id,
    p.id,
    case
      when coalesce(p.compensation_unit, 'hour') = 'day' then 'daily'
      when coalesce(p.compensation_unit, 'hour') = 'week' then 'weekly_salary'
      when coalesce(p.compensation_unit, 'hour') = 'month' then 'monthly_salary'
      else 'hourly'
    end as compensation_type,
    coalesce(
      p.compensation_unit,
      case
        when p.compensation_type = 'daily' then 'day'
        when p.compensation_type = 'weekly_salary' then 'week'
        when p.compensation_type = 'biweekly_salary' then 'week'
        when p.compensation_type = 'monthly_salary' then 'month'
        when p.pay_type = 'day_rate' then 'day'
        when p.pay_type = 'salary' then 'month'
        else 'hour'
      end
    ) as compensation_unit,
    coalesce(
      p.compensation_amount,
      case
        when p.compensation_type = 'weekly_salary' then p.weekly_salary_amount
        when p.compensation_type = 'biweekly_salary' then round(coalesce(p.biweekly_salary_amount, 0) / 2.0, 2)
        when p.compensation_type = 'monthly_salary' then p.monthly_salary_amount
        when p.compensation_type = 'daily' then p.day_rate
        when p.pay_type = 'day_rate' then p.day_rate
        when p.pay_type = 'salary' then coalesce(p.monthly_salary_amount, p.salary_rate)
        else p.hourly_rate
      end
    ) as compensation_amount,
    coalesce(p.payment_method, 'bank_deposit'),
    case
      when coalesce(p.compensation_unit, 'hour') in ('hour', 'day')
        then coalesce(sum(te.regular_hours), 0)
      else null
    end,
    case
      when coalesce(p.compensation_unit, 'hour') in ('hour', 'day')
        then coalesce(sum(te.overtime_hours), 0)
      else null
    end,
    case
      when coalesce(p.compensation_unit, 'hour') in ('hour', 'day')
        then coalesce(sum(
          case
            when te.day_type in ('holiday', 'sick_day', 'vacation_day', 'day_off')
              then coalesce(te.payable_hours, 0)
            else 0
          end
        ), 0)
      else null
    end,
    case
      when coalesce(p.compensation_unit, 'hour') in ('week', 'month')
        then coalesce(p.compensation_amount, p.weekly_salary_amount, p.monthly_salary_amount, p.salary_rate)
      else null
    end,
    0,
    round(
      case
        when coalesce(p.compensation_unit, 'hour') = 'hour' then
          coalesce(sum(te.regular_hours), 0) * coalesce(p.compensation_amount, p.hourly_rate, 0)
          + coalesce(sum(te.overtime_hours), 0) * coalesce(p.compensation_amount, p.hourly_rate, 0) * coalesce(p.overtime_rate_multiplier, 1.5)
          + coalesce(sum(case when te.day_type in ('holiday', 'sick_day', 'vacation_day', 'day_off') then coalesce(te.payable_hours, 0) else 0 end), 0)
            * coalesce(p.compensation_amount, p.hourly_rate, 0)
        when coalesce(p.compensation_unit, 'hour') = 'day' then
          (
            (
              coalesce(sum(te.regular_hours), 0)
              + coalesce(sum(te.overtime_hours), 0)
              + coalesce(sum(case when te.day_type in ('holiday', 'sick_day', 'vacation_day', 'day_off') then coalesce(te.payable_hours, 0) else 0 end), 0)
            ) / greatest(1, coalesce(p.paid_day_hours, 8))
          ) * coalesce(p.compensation_amount, p.day_rate, 0)
        when coalesce(p.compensation_unit, 'hour') = 'week' then
          coalesce(p.compensation_amount, p.weekly_salary_amount, 0) * (v_period_days::numeric / 7)
        when coalesce(p.compensation_unit, 'hour') = 'month' then
          coalesce(p.compensation_amount, p.monthly_salary_amount, p.salary_rate, 0)
          * (
            v_period_days::numeric /
            extract(day from (date_trunc('month', v_run.pay_period_start) + interval '1 month - 1 day'))
          )
        else 0
      end,
      2
    ),
    0,
    round(
      case
        when coalesce(p.compensation_unit, 'hour') = 'hour' then
          coalesce(sum(te.regular_hours), 0) * coalesce(p.compensation_amount, p.hourly_rate, 0)
          + coalesce(sum(te.overtime_hours), 0) * coalesce(p.compensation_amount, p.hourly_rate, 0) * coalesce(p.overtime_rate_multiplier, 1.5)
          + coalesce(sum(case when te.day_type in ('holiday', 'sick_day', 'vacation_day', 'day_off') then coalesce(te.payable_hours, 0) else 0 end), 0)
            * coalesce(p.compensation_amount, p.hourly_rate, 0)
        when coalesce(p.compensation_unit, 'hour') = 'day' then
          (
            (
              coalesce(sum(te.regular_hours), 0)
              + coalesce(sum(te.overtime_hours), 0)
              + coalesce(sum(case when te.day_type in ('holiday', 'sick_day', 'vacation_day', 'day_off') then coalesce(te.payable_hours, 0) else 0 end), 0)
            ) / greatest(1, coalesce(p.paid_day_hours, 8))
          ) * coalesce(p.compensation_amount, p.day_rate, 0)
        when coalesce(p.compensation_unit, 'hour') = 'week' then
          coalesce(p.compensation_amount, p.weekly_salary_amount, 0) * (v_period_days::numeric / 7)
        when coalesce(p.compensation_unit, 'hour') = 'month' then
          coalesce(p.compensation_amount, p.monthly_salary_amount, p.salary_rate, 0)
          * (
            v_period_days::numeric /
            extract(day from (date_trunc('month', v_run.pay_period_start) + interval '1 month - 1 day'))
          )
        else 0
      end,
      2
    ),
    'Generated by payroll run engine'
  from public.people p
  left join public.time_entries te on te.person_id = p.id
    and te.status = 'approved'
    and te.date between v_run.pay_period_start and v_run.pay_period_end
  where p.org_id = v_run.org_id
    and p.employee_status = 'active'
    and coalesce(p.compensation_unit, 'hour') in ('hour', 'day', 'week', 'month')
    and not exists (
      select 1
      from public.payroll_run_lines prl
      where prl.payroll_run_id = v_run.id
        and prl.employee_id = p.id
    )
  group by p.id;

  get diagnostics v_rowcount = row_count;
  v_inserted := v_inserted + v_rowcount;

  update public.time_entries te
  set status = 'included_in_payroll',
      included_in_payroll = true,
      payroll_run_id = v_run.id
  where te.status = 'approved'
    and te.date between v_run.pay_period_start and v_run.pay_period_end
    and te.person_id in (
      select prl.employee_id from public.payroll_run_lines prl where prl.payroll_run_id = v_run.id
    );

  return v_inserted;
end;
$$;
