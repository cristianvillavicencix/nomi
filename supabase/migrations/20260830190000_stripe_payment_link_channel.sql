-- Separate payment-link card payments from public invoice checkout.

alter table public.organizations
  add column if not exists stripe_payment_link_payments_enabled boolean not null default true;

comment on column public.organizations.stripe_payment_link_payments_enabled is
  'When true, staff can send secure payment links and clients can pay via those links.';
