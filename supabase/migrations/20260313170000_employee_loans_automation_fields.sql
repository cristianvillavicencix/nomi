alter table public.employee_loans
  add column if not exists record_type text not null default 'loan',
  add column if not exists status text not null default 'active',
  add column if not exists first_deduction_date date,
  add column if not exists payment_count integer,
  add column if not exists repayment_schedule text not null default 'next_payroll',
  add column if not exists disbursement_receipt_number text,
  add column if not exists disbursement_receipt_generated_at timestamp with time zone,
  add column if not exists completed_at timestamp with time zone;

update public.employee_loans
set record_type = coalesce(record_type, 'loan'),
    status = case
      when coalesce(remaining_balance, 0) <= 0 then 'completed'
      when paused then 'paused'
      when active then 'active'
      else 'cancelled'
    end,
    payment_count = coalesce(
      payment_count,
      case
        when coalesce(fixed_installment_amount, 0) > 0
          then greatest(1, ceil(coalesce(original_amount, 0) / fixed_installment_amount))
        else 1
      end
    ),
    repayment_schedule = coalesce(repayment_schedule, case when start_next_payroll then 'next_payroll' else 'specific_pay_date' end);

alter table public.employee_loans
  drop constraint if exists employee_loans_record_type_check;
alter table public.employee_loans
  add constraint employee_loans_record_type_check
  check (record_type in ('advance', 'loan'));

alter table public.employee_loans
  drop constraint if exists employee_loans_status_check;
alter table public.employee_loans
  add constraint employee_loans_status_check
  check (status in ('active', 'paused', 'completed', 'cancelled'));

alter table public.employee_loans
  drop constraint if exists employee_loans_repayment_schedule_check;
alter table public.employee_loans
  add constraint employee_loans_repayment_schedule_check
  check (repayment_schedule in ('next_payroll', 'specific_pay_date'));

alter table public.employee_loans
  drop constraint if exists employee_loans_deduction_mode_check;
alter table public.employee_loans
  add constraint employee_loans_deduction_mode_check
  check (deduction_mode in ('fixed_installment', 'single_next_payroll'));

alter table public.employee_loan_deductions
  add column if not exists receipt_number text,
  add column if not exists receipt_generated_at timestamp with time zone;
