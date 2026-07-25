-- Default for new invoices: save client card on file for future charges.

alter table public.organizations
  add column if not exists stripe_save_cards_default boolean not null default true;

comment on column public.organizations.stripe_save_cards_default is
  'When true, new invoices default to saving the client card for future charges (per-invoice can override).';
