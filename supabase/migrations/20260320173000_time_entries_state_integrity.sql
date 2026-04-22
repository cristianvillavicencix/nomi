create or replace function public.normalize_time_entry_payroll_state()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'paid' and new.payment_run_id is null and new.payroll_run_id is null then
    raise exception 'time_entries with status paid must have payment_run_id or payroll_run_id';
  end if;

  if new.status in ('included_in_payroll', 'paid') then
    new.included_in_payroll := true;
  end if;

  if new.status = 'included_in_payroll'
     and new.payment_run_id is null
     and new.payroll_run_id is null then
    new.status := 'approved';
    new.included_in_payroll := false;
  end if;

  if new.status = 'approved'
     and (new.payment_run_id is not null or new.payroll_run_id is not null) then
    new.status := 'included_in_payroll';
    new.included_in_payroll := true;
  end if;

  if new.status in ('draft', 'submitted', 'approved', 'rejected')
     and new.payment_run_id is null
     and new.payroll_run_id is null then
    new.included_in_payroll := false;
  end if;

  return new;
end;
$$;

drop trigger if exists time_entries_normalize_payroll_state on public.time_entries;

create trigger time_entries_normalize_payroll_state
before insert or update of status, included_in_payroll, payment_run_id, payroll_run_id
on public.time_entries
for each row
execute function public.normalize_time_entry_payroll_state();

alter table public.time_entries
  drop constraint if exists time_entries_paid_requires_payment_or_payroll_check;

alter table public.time_entries
  add constraint time_entries_paid_requires_payment_or_payroll_check
  check (not (status = 'paid' and payment_run_id is null and payroll_run_id is null));
