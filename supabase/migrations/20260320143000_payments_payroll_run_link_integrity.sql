-- Keep at most one payment linked to each payroll run before enforcing uniqueness.
with ranked as (
  select
    p.id,
    row_number() over (
      partition by p.payroll_run_id
      order by
        case when p.status = 'paid' then 1 else 0 end desc,
        p.created_at desc nulls last,
        p.id desc
    ) as rn
  from public.payments p
  where p.payroll_run_id is not null
)
update public.payments p
set payroll_run_id = null
from ranked r
where p.id = r.id
  and r.rn > 1;

create unique index if not exists payments_payroll_run_id_unique
  on public.payments(payroll_run_id)
  where payroll_run_id is not null;

create or replace function public.sync_payment_with_payroll_run()
returns trigger
language plpgsql
as $$
declare
  v_run public.payroll_runs%rowtype;
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

  if coalesce(new.category, 'mixed') = 'sales_commissions' then
    raise exception 'Payment category sales_commissions cannot be linked to payroll_run_id';
  end if;

  -- Enforce canonical linkage fields from payroll run.
  new.org_id := v_run.org_id;
  new.pay_period_start := v_run.pay_period_start;
  new.pay_period_end := v_run.pay_period_end;
  new.pay_date := v_run.payday;

  return new;
end;
$$;

drop trigger if exists payments_sync_with_payroll_run on public.payments;

create trigger payments_sync_with_payroll_run
before insert or update of payroll_run_id, org_id, pay_period_start, pay_period_end, pay_date, category
on public.payments
for each row
execute function public.sync_payment_with_payroll_run();
