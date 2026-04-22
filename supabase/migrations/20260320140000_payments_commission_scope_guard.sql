alter table public.payments
  add column if not exists payroll_run_id bigint references public.payroll_runs(id) on update cascade on delete set null;

update public.payments
set payroll_run_id = null
where coalesce(category, 'mixed') = 'sales_commissions'
  and payroll_run_id is not null;

alter table public.payments
  drop constraint if exists payments_sales_commissions_scope_check;

alter table public.payments
  add constraint payments_sales_commissions_scope_check
  check (not (coalesce(category, 'mixed') = 'sales_commissions' and payroll_run_id is not null));

drop index if exists public.payment_lines_source_unique;

create unique index if not exists payment_lines_time_entry_unique
  on public.payment_lines (source_type, source_id)
  where source_id is not null and source_type = 'time_entry';

create unique index if not exists payment_lines_commission_person_unique
  on public.payment_lines (source_type, source_id, person_id)
  where source_id is not null and source_type = 'commission';

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
          when d.salesperson_ids is null then array[d.sales_id]
          else array_append(d.salesperson_ids, d.sales_id)
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
