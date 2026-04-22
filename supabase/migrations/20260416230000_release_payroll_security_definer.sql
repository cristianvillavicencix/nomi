-- Run cleanup as an elevated role so RLS or role quirks cannot block releasing hours.
-- Also grants RPC access for one-click repair from the app (e.g. runs cancelled before migrations applied).

create or replace function public.release_payroll_run_linked_resources(p_run_id bigint)
returns void
language plpgsql
security definer
set search_path = public
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

revoke all on function public.release_payroll_run_linked_resources(bigint) from public;
grant execute on function public.release_payroll_run_linked_resources(bigint) to authenticated;
grant execute on function public.release_payroll_run_linked_resources(bigint) to service_role;

-- Idempotent repair for already-cancelled runs (e.g. cancelled before triggers existed).
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
