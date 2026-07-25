-- Stripe: server (Supabase secrets) vs settings (manual keys in CRM), per-channel toggles.

alter table public.organizations
  add column if not exists stripe_credential_mode text not null default 'server'
    check (stripe_credential_mode in ('server', 'settings')),
  add column if not exists stripe_invoice_payments_enabled boolean not null default true,
  add column if not exists stripe_proposal_payments_enabled boolean not null default false;

comment on column public.organizations.stripe_credential_mode is
  'server = Stripe keys from Supabase Edge secrets; settings = keys stored in this org (Settings UI).';
comment on column public.organizations.stripe_invoice_payments_enabled is
  'When true, clients can pay invoices and payment links by card (if Stripe is configured).';
comment on column public.organizations.stripe_proposal_payments_enabled is
  'When true, clients can pay proposal deposits by card (if Stripe is configured).';

-- Preserve prior global stripe flag for proposal channel only.
update public.organizations
set stripe_proposal_payments_enabled = true
where client_billing_mode = 'stripe';
