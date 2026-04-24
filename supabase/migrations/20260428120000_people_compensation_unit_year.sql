-- Allow annual (year-based) salary as a distinct compensation unit for people.
alter table public.people
  drop constraint if exists people_compensation_unit_check;

alter table public.people
  add constraint people_compensation_unit_check
  check (
    compensation_unit is null
    or compensation_unit in (
      'hour',
      'day',
      'week',
      'month',
      'year',
      'commission'
    )
  );

-- Payroll run generation: treat 'year' like monthly proration using annual / 12.
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

  if v_run.status in ('paid', 'cancelled') then
    raise exception 'Payroll run % cannot be regenerated in status %', p_payroll_run_id, v_run.status;
  end if;

  if v_run.category = 'sales_commissions' then
    raise exception 'Category "sales_commissions" is not allowed in payroll_runs. Use payments for commission payouts.';
  end if;

  update public.employee_loans l
  set
    remaining_balance = round(l.remaining_balance + previous_deductions.total_deductions, 2),
    active = true
  from (
    select
      eld.loan_id,
      sum(eld.deducted_amount) as total_deductions
    from public.employee_loan_deductions eld
    where eld.payroll_run_id = v_run.id
    group by eld.loan_id
  ) as previous_deductions
  where l.id = previous_deductions.loan_id;

  delete from public.employee_loan_deductions
  where payroll_run_id = v_run.id;

  -- Regeneration cleanup:
  -- If a run is regenerated, linked entries should return to approved state.
  update public.time_entries
  set
    payroll_run_id = null,
    included_in_payroll = false,
    status = case
      when status = 'included_in_payroll' then 'approved'
      else status
    end
  where payroll_run_id = v_run.id;

  delete from public.payroll_run_lines
  where payroll_run_id = v_run.id;

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
      when coalesce(p.compensation_unit, 'hour') in ('month', 'year') then 'monthly_salary'
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
      case
        when p.compensation_unit = 'year' then
          coalesce(
            p.monthly_salary_amount,
            p.salary_rate,
            nullif(p.annual_salary, 0) / 12.0,
            nullif(p.compensation_amount, 0) / 12.0
          )
        else p.compensation_amount
      end,
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
      when coalesce(p.compensation_unit, 'hour') = 'year' then
        coalesce(
          p.monthly_salary_amount,
          p.salary_rate,
          nullif(p.annual_salary, 0) / 12.0,
          nullif(p.compensation_amount, 0) / 12.0
        )
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
        when coalesce(p.compensation_unit, 'hour') = 'year' then
          (
            coalesce(
              p.monthly_salary_amount,
              p.salary_rate,
              nullif(p.annual_salary, 0) / 12.0,
              nullif(p.compensation_amount, 0) / 12.0
            )
          )
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
        when coalesce(p.compensation_unit, 'hour') = 'year' then
          (
            coalesce(
              p.monthly_salary_amount,
              p.salary_rate,
              nullif(p.annual_salary, 0) / 12.0,
              nullif(p.compensation_amount, 0) / 12.0
            )
          )
          * (
            v_period_days::numeric /
            extract(day from (date_trunc('month', v_run.pay_period_start) + interval '1 month - 1 day'))
          )
        else 0
      end,
      2
    ),
    case
      when v_run.employee_id is not null then 'Generated for a single employee payroll run'
      else 'Generated for payroll run period'
    end
  from public.people p
  left join public.time_entries te
    on te.person_id = p.id
   and te.date between v_run.pay_period_start and v_run.pay_period_end
   and te.status = 'approved'
  where p.status = 'active'
    and (
      v_run.category = 'mixed'
      or (v_run.category = 'hourly' and coalesce(p.compensation_unit, 'hour') in ('hour', 'day'))
      or (v_run.category = 'salaried' and coalesce(p.compensation_unit, 'hour') in ('week', 'month', 'year'))
      or (v_run.category = 'subcontractor' and p.type = 'subcontractor')
    )
    and (v_run.employee_id is null or p.id = v_run.employee_id)
  group by
    p.id,
    p.compensation_type,
    p.compensation_unit,
    p.compensation_amount,
    p.payment_method,
    p.hourly_rate,
    p.day_rate,
    p.salary_rate,
    p.weekly_salary_amount,
    p.biweekly_salary_amount,
    p.monthly_salary_amount,
    p.annual_salary,
    p.overtime_rate_multiplier,
    p.pay_type,
    p.paid_day_hours;

  get diagnostics v_rowcount = row_count;
  v_inserted := v_rowcount;

  update public.time_entries te
  set
    payroll_run_id = v_run.id,
    included_in_payroll = true,
    status = case
      when te.status = 'approved' then 'included_in_payroll'
      else te.status
    end
  where te.status in ('approved', 'included_in_payroll')
    and te.date between v_run.pay_period_start and v_run.pay_period_end
    and exists (
      select 1
      from public.payroll_run_lines prl
      where prl.payroll_run_id = v_run.id
        and prl.employee_id = te.person_id
    );

  update public.payroll_run_lines prl
  set
    loan_deductions = coalesce(loan_data.total_deductions, 0),
    total_deductions = coalesce(prl.unpaid_absence_deduction, 0)
      + coalesce(prl.other_deductions, 0)
      + coalesce(loan_data.total_deductions, 0),
    net_pay = round(
      greatest(
        0,
        coalesce(prl.gross_pay, 0)
        - (
          coalesce(prl.unpaid_absence_deduction, 0)
          + coalesce(prl.other_deductions, 0)
          + coalesce(loan_data.total_deductions, 0)
        )
      ),
      2
    )
  from (
    select
      prl_inner.id as payroll_run_line_id,
      sum(
        least(
          case
            when l.deduction_mode = 'single_next_payroll' then l.remaining_balance
            else l.fixed_installment_amount
          end,
          l.remaining_balance
        )
      ) as total_deductions
    from public.payroll_run_lines prl_inner
    join public.employee_loans l on l.employee_id = prl_inner.employee_id
    where prl_inner.payroll_run_id = v_run.id
      and l.active = true
      and coalesce(l.paused, false) = false
      and (
        coalesce(l.start_next_payroll, true) = true
        or l.first_deduction_date is null
        or l.first_deduction_date <= v_run.payday
      )
    group by prl_inner.id
  ) as loan_data
  where prl.id = loan_data.payroll_run_line_id;

  insert into public.employee_loan_deductions (
    loan_id,
    payroll_run_id,
    deduction_date,
    scheduled_amount,
    deducted_amount,
    remaining_balance_after,
    notes
  )
  select
    l.id,
    v_run.id,
    v_run.payday,
    least(
      case
        when l.deduction_mode = 'single_next_payroll' then l.remaining_balance
        else l.fixed_installment_amount
      end,
      l.remaining_balance
    ),
    least(
      case
        when l.deduction_mode = 'single_next_payroll' then l.remaining_balance
        else l.fixed_installment_amount
      end,
      l.remaining_balance
    ),
    round(
      greatest(
        0,
        l.remaining_balance - least(
          case
            when l.deduction_mode = 'single_next_payroll' then l.remaining_balance
            else l.fixed_installment_amount
          end,
          l.remaining_balance
        )
      ),
      2
    ),
    'Generated from payroll run'
  from public.employee_loans l
  where l.active = true
    and coalesce(l.paused, false) = false
    and (
      coalesce(l.start_next_payroll, true) = true
      or l.first_deduction_date is null
      or l.first_deduction_date <= v_run.payday
    )
    and exists (
      select 1
      from public.payroll_run_lines prl
      where prl.payroll_run_id = v_run.id
        and prl.employee_id = l.employee_id
    );

  update public.employee_loans l
  set
    remaining_balance = round(
      greatest(0, l.remaining_balance - loan_updates.total_deductions),
      2
    ),
    active = case
      when greatest(0, l.remaining_balance - loan_updates.total_deductions) = 0 then false
      else l.active
    end,
    paused = case
      when greatest(0, l.remaining_balance - loan_updates.total_deductions) = 0 then false
      else l.paused
    end
  from (
    select
      l_inner.id as loan_id,
      sum(eld.deducted_amount) as total_deductions
    from public.employee_loans l_inner
    join public.employee_loan_deductions eld
      on eld.loan_id = l_inner.id
     and eld.payroll_run_id = v_run.id
    group by l_inner.id
  ) as loan_updates
  where l.id = loan_updates.loan_id;

  return v_inserted;
end;
$$;
