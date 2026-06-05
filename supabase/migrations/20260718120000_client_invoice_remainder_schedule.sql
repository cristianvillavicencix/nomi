-- Remainder collection schedule for deposit + auto-charge invoices.

alter table public.client_invoices
  add column if not exists remainder_schedule jsonb;

comment on column public.client_invoices.remainder_schedule is
  'JSON config for when/how the balance after upfront_percent is auto-charged (timing, installment_count, dates).';
