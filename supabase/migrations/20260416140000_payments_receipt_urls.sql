-- Proof images for payment approval / mark-as-paid (stored as public attachment URLs).
alter table public.payments
  add column if not exists approved_receipt_url text,
  add column if not exists paid_receipt_url text;

comment on column public.payments.approved_receipt_url is 'Optional proof image when the payment run was approved.';
comment on column public.payments.paid_receipt_url is 'Proof image when the payment run was marked paid (bank/Zelle/check, etc.).';
