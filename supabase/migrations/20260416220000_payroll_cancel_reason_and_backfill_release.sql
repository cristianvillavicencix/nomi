-- Store why a run was cancelled; expose reusable cleanup for triggers and one-time backfill.

alter table public.payroll_runs
  add column if not exists cancellation_reason text;

comment on column public.payroll_runs.cancellation_reason is
  'Required when cancelling from the app; explains why the run was voided.';

-- Idempotent: safe to run multiple times (no-op when nothing is linked to the run).
create or replace function public.release_payroll_run_linked_resources(p_run_id bigint)
returns void
language plpgsql
security invoker
as $$
begin
  update public.employee_loans l
  set
    remaining_balance = round(l.remaining_balance + previous_deductions.total_deductions, 2),
    active = true
  from (
    select
      eld.loan_id,
      sum(eld.deducted_amount) as total_deductions
    from public.employee_loan_deductions eld
    where eld.payroll_run_id = p_run_id
    group by eld.loan_id
  ) as previous_deductions
  where l.id = previous_deductions.loan_id;

  delete from public.employee_loan_deductions
  where payroll_run_id = p_run_id;

  update public.time_entries te
  set
    payroll_run_id = null,
    included_in_payroll = false,
    status = case
      when te.status = 'included_in_payroll' then 'approved'
      else te.status
    end
  where te.payroll_run_id = p_run_id;

  delete from public.payroll_run_lines
  where payroll_run_id = p_run_id;

  update public.payments p
  set payroll_run_id = null
  where p.payroll_run_id = p_run_id;
end;
$$;

create or replace function public.release_payroll_run_resources_on_cancel()
returns trigger
language plpgsql
security invoker
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    perform public.release_payroll_run_linked_resources(new.id);
  end if;
  return new;
end;
$$;

-- Runs that were cancelled before the release trigger existed: fix linked hours and lines.
do $$
declare
  r record;
begin
  for r in select id from public.payroll_runs where status = 'cancelled'
  loop
    perform public.release_payroll_run_linked_resources(r.id);
  end loop;
end;
$$;
