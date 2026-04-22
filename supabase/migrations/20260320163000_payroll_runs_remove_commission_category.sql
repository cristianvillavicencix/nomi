update public.payroll_runs
set category = 'mixed'
where category = 'sales_commissions';

alter table public.payroll_runs
  drop constraint if exists payroll_runs_category_check;

alter table public.payroll_runs
  add constraint payroll_runs_category_check
  check (category in ('hourly', 'salaried', 'subcontractor', 'mixed'));
