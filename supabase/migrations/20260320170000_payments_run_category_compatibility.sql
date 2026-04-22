create or replace function public.sync_payment_with_payroll_run()
returns trigger
language plpgsql
as $$
declare
  v_run public.payroll_runs%rowtype;
  v_category text;
begin
  if new.payroll_run_id is null then
    return new;
  end if;

  select *
  into v_run
  from public.payroll_runs
  where id = new.payroll_run_id;

  if v_run is null then
    raise exception 'Payroll run % not found for payment', new.payroll_run_id;
  end if;

  v_category := coalesce(new.category, 'mixed');

  if v_category = 'sales_commissions' then
    raise exception 'Payment category sales_commissions cannot be linked to payroll_run_id';
  end if;

  if v_run.category = 'sales_commissions' then
    raise exception 'Payroll run category sales_commissions is not allowed for payment linkage';
  end if;

  if v_run.category <> 'mixed' and v_category <> 'mixed' and v_category <> v_run.category then
    raise exception 'Payment category % is incompatible with payroll_run category %', v_category, v_run.category;
  end if;

  new.category := case
    when v_category = 'mixed' then v_run.category
    else v_category
  end;

  -- Enforce canonical linkage fields from payroll run.
  new.org_id := v_run.org_id;
  new.pay_period_start := v_run.pay_period_start;
  new.pay_period_end := v_run.pay_period_end;
  new.pay_date := v_run.payday;

  return new;
end;
$$;
