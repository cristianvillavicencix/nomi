-- Optional discount on client invoices

alter table public.client_invoices
  add column if not exists discount_amount numeric(12, 2) not null default 0
    check (discount_amount >= 0);

comment on column public.client_invoices.discount_amount is
  'Flat discount applied to the invoice subtotal before transfer fee.';
