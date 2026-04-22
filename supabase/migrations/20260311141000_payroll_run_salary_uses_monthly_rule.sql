create or replace function public.generate_payroll_run(p_payroll_run_id bigint)
returns integer
language plpgsql
security invoker
as $$
declare
  v_run public.payroll_runs%rowtype;
  v_inserted integer := 0;
  v_rowcount integer := 0;
  v_payroll_settings jsonb := '{}'::jsonb;
  v_monthly_pay_rule text := 'end_of_month';
  v_monthly_day integer := 30;
  v_payday_day integer := 0;
  v_last_day integer := 0;
  v_target_day integer := 0;
  v_is_monthly_salary_payday boolean := false;
begin
  select * into v_run from public.payroll_runs where id = p_payroll_run_id;
  if v_run is null then
    raise exception 'Payroll run % not found', p_payroll_run_id;
  end if;

  select coalesce(config->'payrollSettings', '{}'::jsonb)
  into v_payroll_settings
  from public.configuration
  where id = 1;

  v_monthly_pay_rule := coalesce(v_payroll_settings->>'monthlyPayRule', 'end_of_month');
  v_monthly_day := greatest(
    1,
    least(31, coalesce((v_payroll_settings->>'monthlyDayOfMonth')::integer, 30))
  );

  if v_run.pay_schedule = 'monthly' then
    v_payday_day := extract(day from v_run.payday)::integer;
    v_last_day := extract(
      day from (date_trunc('month', v_run.payday)::date + interval '1 month - 1 day')
    )::integer;

    if v_monthly_pay_rule = 'day_of_month' then
      v_target_day := least(v_monthly_day, v_last_day);
      v_is_monthly_salary_payday := (v_payday_day = v_target_day);
    else
      v_is_monthly_salary_payday := (v_payday_day = v_last_day);
    end if;
  end if;

  insert into public.payroll_run_lines (
    payroll_run_id,
    employee_id,
    compensation_type,
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
    coalesce(
      p.compensation_type,
      case
        when p.pay_type = 'salary' then 'monthly_salary'
        when p.pay_type = 'hourly' then 'hourly'
        else null
      end
    ) as effective_compensation_type,
    coalesce(p.payment_method, 'bank_deposit'),
    case
      when coalesce(p.compensation_type, case when p.pay_type = 'hourly' then 'hourly' else null end) = 'hourly'
        then coalesce(sum(te.regular_hours), 0)
      else null
    end,
    case
      when coalesce(p.compensation_type, case when p.pay_type = 'hourly' then 'hourly' else null end) = 'hourly'
        then coalesce(sum(te.overtime_hours), 0)
      else null
    end,
    case
      when coalesce(p.compensation_type, case when p.pay_type = 'hourly' then 'hourly' else null end) = 'hourly'
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
      when coalesce(p.compensation_type, case when p.pay_type = 'salary' then 'monthly_salary' else null end) = 'weekly_salary'
        then coalesce(p.weekly_salary_amount, 0)
      when coalesce(p.compensation_type, case when p.pay_type = 'salary' then 'monthly_salary' else null end) = 'biweekly_salary'
        then coalesce(p.biweekly_salary_amount, 0)
      when coalesce(p.compensation_type, case when p.pay_type = 'salary' then 'monthly_salary' else null end) = 'monthly_salary'
        then coalesce(p.monthly_salary_amount, 0)
      else null
    end,
    0,
    round(
      case
        when coalesce(p.compensation_type, case when p.pay_type = 'hourly' then 'hourly' else null end) = 'hourly' then
          coalesce(sum(te.regular_hours), 0) * coalesce(p.hourly_rate, 0)
          + coalesce(sum(te.overtime_hours), 0) * coalesce(p.hourly_rate, 0) * coalesce(p.overtime_rate_multiplier, 1.5)
          + coalesce(sum(case when te.day_type in ('holiday', 'sick_day', 'vacation_day', 'day_off') then coalesce(te.payable_hours, 0) else 0 end), 0) * coalesce(p.hourly_rate, 0)
        when coalesce(p.compensation_type, case when p.pay_type = 'salary' then 'monthly_salary' else null end) = 'weekly_salary'
          then coalesce(p.weekly_salary_amount, 0)
        when coalesce(p.compensation_type, case when p.pay_type = 'salary' then 'monthly_salary' else null end) = 'biweekly_salary'
          then coalesce(p.biweekly_salary_amount, 0)
        when coalesce(p.compensation_type, case when p.pay_type = 'salary' then 'monthly_salary' else null end) = 'monthly_salary'
          then coalesce(p.monthly_salary_amount, 0)
        else 0
      end,
      2
    ),
    0,
    round(
      case
        when coalesce(p.compensation_type, case when p.pay_type = 'hourly' then 'hourly' else null end) = 'hourly' then
          coalesce(sum(te.regular_hours), 0) * coalesce(p.hourly_rate, 0)
          + coalesce(sum(te.overtime_hours), 0) * coalesce(p.hourly_rate, 0) * coalesce(p.overtime_rate_multiplier, 1.5)
          + coalesce(sum(case when te.day_type in ('holiday', 'sick_day', 'vacation_day', 'day_off') then coalesce(te.payable_hours, 0) else 0 end), 0) * coalesce(p.hourly_rate, 0)
        when coalesce(p.compensation_type, case when p.pay_type = 'salary' then 'monthly_salary' else null end) = 'weekly_salary'
          then coalesce(p.weekly_salary_amount, 0)
        when coalesce(p.compensation_type, case when p.pay_type = 'salary' then 'monthly_salary' else null end) = 'biweekly_salary'
          then coalesce(p.biweekly_salary_amount, 0)
        when coalesce(p.compensation_type, case when p.pay_type = 'salary' then 'monthly_salary' else null end) = 'monthly_salary'
          then coalesce(p.monthly_salary_amount, 0)
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
    and coalesce(
      p.compensation_type,
      case
        when p.pay_type = 'salary' then 'monthly_salary'
        when p.pay_type = 'hourly' then 'hourly'
        else null
      end
    ) in ('hourly', 'weekly_salary', 'biweekly_salary', 'monthly_salary')
    and (
      coalesce(
        p.compensation_type,
        case when p.pay_type = 'salary' then 'monthly_salary' else null end
      ) <> 'monthly_salary'
      or v_is_monthly_salary_payday
    )
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
