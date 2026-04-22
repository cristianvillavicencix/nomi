-- When a payroll run is cancelled, release linked time entries back to approved,
-- reverse loan deductions, remove lines, unlink payments, and clear manual deduction override.

create or replace function public.enforce_payroll_run_status_transition()
returns trigger
language plpgsql
as $$
begin
  if old.status is distinct from new.status then
    if old.status = 'draft' and new.status not in ('draft', 'reviewed', 'approved', 'cancelled') then
      raise exception 'Invalid payroll_runs status transition: % -> %', old.status, new.status;
    elsif old.status = 'reviewed' and new.status not in ('reviewed', 'draft', 'approved', 'cancelled') then
      raise exception 'Invalid payroll_runs status transition: % -> %', old.status, new.status;
    elsif old.status = 'approved' and new.status not in ('approved', 'reviewed', 'draft', 'cancelled', 'paid') then
      raise exception 'Invalid payroll_runs status transition: % -> %', old.status, new.status;
    elsif old.status = 'paid' and new.status not in ('paid', 'approved') then
      raise exception 'Invalid payroll_runs status transition: % -> %', old.status, new.status;
    elsif old.status = 'cancelled' and new.status not in ('cancelled', 'draft') then
      raise exception 'Invalid payroll_runs status transition: % -> %', old.status, new.status;
    end if;
  end if;

  if new.status in ('draft', 'reviewed', 'cancelled') then
    if new.status <> 'approved' then
      new.approved_at := null;
    end if;
    if new.status <> 'paid' then
      new.paid_at := null;
    end if;
  elsif new.status = 'approved' then
    new.approved_at := coalesce(new.approved_at, now());
    new.paid_at := null;
  elsif new.status = 'paid' then
    new.approved_at := coalesce(new.approved_at, now());
    new.paid_at := coalesce(new.paid_at, now());
  end if;

  if old.status is distinct from new.status and new.status = 'cancelled' then
    new.manual_deduction_total := null;
  end if;

  return new;
end;
$$;

create or replace function public.release_payroll_run_resources_on_cancel()
returns trigger
language plpgsql
security invoker
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    update public.employee_loans l
    set
      remaining_balance = round(l.remaining_balance + previous_deductions.total_deductions, 2),
      active = true
    from (
      select
        eld.loan_id,
        sum(eld.deducted_amount) as total_deductions
      from public.employee_loan_deductions eld
      where eld.payroll_run_id = new.id
      group by eld.loan_id
    ) as previous_deductions
    where l.id = previous_deductions.loan_id;

    delete from public.employee_loan_deductions
    where payroll_run_id = new.id;

    update public.time_entries te
    set
      payroll_run_id = null,
      included_in_payroll = false,
      status = case
        when te.status = 'included_in_payroll' then 'approved'
        else te.status
      end
    where te.payroll_run_id = new.id;

    delete from public.payroll_run_lines
    where payroll_run_id = new.id;

    update public.payments p
    set payroll_run_id = null
    where p.payroll_run_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists payroll_runs_release_on_cancel on public.payroll_runs;

create trigger payroll_runs_release_on_cancel
after update of status
on public.payroll_runs
for each row
execute function public.release_payroll_run_resources_on_cancel();
