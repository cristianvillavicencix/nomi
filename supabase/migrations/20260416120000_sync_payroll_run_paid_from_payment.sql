-- When a payment linked to a payroll run is marked paid, close the payroll run and set paid_at.
-- When payment is reopened from paid, return the payroll run to approved (for corrections).

create or replace function public.sync_payroll_run_when_payment_paid()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.payroll_run_id is null then
    return new;
  end if;

  if new.status = 'paid' then
    if tg_op = 'INSERT' or (tg_op = 'UPDATE' and old.status is distinct from 'paid') then
      update public.payroll_runs pr
      set
        status = 'paid',
        paid_at = coalesce(new.paid_at, now())
      where pr.id = new.payroll_run_id
        and pr.status <> 'cancelled';
    end if;
  elsif tg_op = 'UPDATE' and old.status = 'paid' and new.status is distinct from 'paid' then
    update public.payroll_runs pr
    set
      status = 'approved',
      paid_at = null
    where pr.id = old.payroll_run_id
      and pr.status = 'paid';
  end if;

  return new;
end;
$$;

drop trigger if exists payments_sync_payroll_run_paid on public.payments;

create trigger payments_sync_payroll_run_paid
after insert or update of status, paid_at, payroll_run_id
on public.payments
for each row
execute function public.sync_payroll_run_when_payment_paid();
