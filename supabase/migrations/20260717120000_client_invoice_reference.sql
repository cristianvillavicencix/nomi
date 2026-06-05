-- Optional PO / client reference on client invoices

alter table public.client_invoices
  add column if not exists reference text;

comment on column public.client_invoices.reference is
  'Client PO number or other external reference shown on the invoice.';
