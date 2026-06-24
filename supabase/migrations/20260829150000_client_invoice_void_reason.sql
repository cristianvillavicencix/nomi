-- Reason captured when staff void an invoice.
alter table public.client_invoices
  add column if not exists void_reason text;

comment on column public.client_invoices.void_reason is
  'Staff-provided reason when the invoice was voided.';
