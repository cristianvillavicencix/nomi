-- Optional override for total deductions on a payroll run (review / net display).
-- When null, the UI uses the sum of payroll_run_lines.total_deductions.

alter table public.payroll_runs
  add column if not exists manual_deduction_total numeric(14, 2);

comment on column public.payroll_runs.manual_deduction_total is
  'Optional manual override for total deductions on this run. When null, derived from payroll line totals.';
