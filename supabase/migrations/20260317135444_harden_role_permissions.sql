create or replace function public.current_user_is_administrator()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.sales
    where user_id = auth.uid()
      and administrator = true
  );
$$;

create or replace function public.current_user_has_any_role(expected_roles text[])
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.sales
    where user_id = auth.uid()
      and (
        administrator = true
        or coalesce(roles, '{}') && expected_roles
      )
  );
$$;

drop policy if exists "Payments insert" on public.payments;
drop policy if exists "Payments update" on public.payments;
drop policy if exists "Payments delete" on public.payments;
drop policy if exists "Payment lines insert" on public.payment_lines;
drop policy if exists "Payment lines update" on public.payment_lines;
drop policy if exists "Payment lines delete" on public.payment_lines;
drop policy if exists "Payroll runs insert" on public.payroll_runs;
drop policy if exists "Payroll runs update" on public.payroll_runs;
drop policy if exists "Payroll runs delete" on public.payroll_runs;
drop policy if exists "Payroll run lines insert" on public.payroll_run_lines;
drop policy if exists "Payroll run lines update" on public.payroll_run_lines;
drop policy if exists "Payroll run lines delete" on public.payroll_run_lines;
drop policy if exists "Employee loans insert" on public.employee_loans;
drop policy if exists "Employee loans update" on public.employee_loans;
drop policy if exists "Employee loans delete" on public.employee_loans;
drop policy if exists "Employee loan deductions insert" on public.employee_loan_deductions;
drop policy if exists "Employee loan deductions update" on public.employee_loan_deductions;
drop policy if exists "Employee loan deductions delete" on public.employee_loan_deductions;
drop policy if exists "Employee PTO adjustments insert" on public.employee_pto_adjustments;
drop policy if exists "Employee PTO adjustments update" on public.employee_pto_adjustments;
drop policy if exists "Employee PTO adjustments delete" on public.employee_pto_adjustments;

create policy "Payments insert" on public.payments
  as permissive for insert to authenticated
  with check (public.current_user_has_any_role(array['accountant', 'payroll_manager']));

create policy "Payments update" on public.payments
  as permissive for update to authenticated
  using (public.current_user_has_any_role(array['accountant', 'payroll_manager']))
  with check (public.current_user_has_any_role(array['accountant', 'payroll_manager']));

create policy "Payments delete" on public.payments
  as permissive for delete to authenticated
  using (public.current_user_has_any_role(array['accountant', 'payroll_manager']));

create policy "Payment lines insert" on public.payment_lines
  as permissive for insert to authenticated
  with check (public.current_user_has_any_role(array['accountant', 'payroll_manager']));

create policy "Payment lines update" on public.payment_lines
  as permissive for update to authenticated
  using (public.current_user_has_any_role(array['accountant', 'payroll_manager']))
  with check (public.current_user_has_any_role(array['accountant', 'payroll_manager']));

create policy "Payment lines delete" on public.payment_lines
  as permissive for delete to authenticated
  using (public.current_user_has_any_role(array['accountant', 'payroll_manager']));

create policy "Payroll runs insert" on public.payroll_runs
  as permissive for insert to authenticated
  with check (public.current_user_has_any_role(array['accountant', 'payroll_manager']));

create policy "Payroll runs update" on public.payroll_runs
  as permissive for update to authenticated
  using (public.current_user_has_any_role(array['accountant', 'payroll_manager']))
  with check (public.current_user_has_any_role(array['accountant', 'payroll_manager']));

create policy "Payroll runs delete" on public.payroll_runs
  as permissive for delete to authenticated
  using (public.current_user_has_any_role(array['accountant', 'payroll_manager']));

create policy "Payroll run lines insert" on public.payroll_run_lines
  as permissive for insert to authenticated
  with check (public.current_user_has_any_role(array['accountant', 'payroll_manager']));

create policy "Payroll run lines update" on public.payroll_run_lines
  as permissive for update to authenticated
  using (public.current_user_has_any_role(array['accountant', 'payroll_manager']))
  with check (public.current_user_has_any_role(array['accountant', 'payroll_manager']));

create policy "Payroll run lines delete" on public.payroll_run_lines
  as permissive for delete to authenticated
  using (public.current_user_has_any_role(array['accountant', 'payroll_manager']));

create policy "Employee loans insert" on public.employee_loans
  as permissive for insert to authenticated
  with check (public.current_user_has_any_role(array['accountant', 'payroll_manager']));

create policy "Employee loans update" on public.employee_loans
  as permissive for update to authenticated
  using (public.current_user_has_any_role(array['accountant', 'payroll_manager']))
  with check (public.current_user_has_any_role(array['accountant', 'payroll_manager']));

create policy "Employee loans delete" on public.employee_loans
  as permissive for delete to authenticated
  using (public.current_user_has_any_role(array['accountant', 'payroll_manager']));

create policy "Employee loan deductions insert" on public.employee_loan_deductions
  as permissive for insert to authenticated
  with check (public.current_user_has_any_role(array['accountant', 'payroll_manager']));

create policy "Employee loan deductions update" on public.employee_loan_deductions
  as permissive for update to authenticated
  using (public.current_user_has_any_role(array['accountant', 'payroll_manager']))
  with check (public.current_user_has_any_role(array['accountant', 'payroll_manager']));

create policy "Employee loan deductions delete" on public.employee_loan_deductions
  as permissive for delete to authenticated
  using (public.current_user_has_any_role(array['accountant', 'payroll_manager']));

create policy "Employee PTO adjustments insert" on public.employee_pto_adjustments
  as permissive for insert to authenticated
  with check (public.current_user_has_any_role(array['hr']));

create policy "Employee PTO adjustments update" on public.employee_pto_adjustments
  as permissive for update to authenticated
  using (public.current_user_has_any_role(array['hr']))
  with check (public.current_user_has_any_role(array['hr']));

create policy "Employee PTO adjustments delete" on public.employee_pto_adjustments
  as permissive for delete to authenticated
  using (public.current_user_has_any_role(array['hr']));
