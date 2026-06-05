-- Deposit vs full payment and automatic balance collection settings.

alter table public.client_invoices
  add column if not exists upfront_percent numeric(5, 2) not null default 100
    check (upfront_percent > 0 and upfront_percent <= 100),
  add column if not exists auto_charge_remainder boolean not null default false,
  add column if not exists amount_paid numeric(12, 2) not null default 0
    check (amount_paid >= 0);

comment on column public.client_invoices.upfront_percent is
  'Percentage of invoice total collected on first online payment (100 = pay in full).';

comment on column public.client_invoices.auto_charge_remainder is
  'When true with save_card_for_future_charges, remaining balance is charged automatically to the saved card.';

comment on column public.client_invoices.amount_paid is
  'Running total collected toward this invoice (partial payments supported).';
