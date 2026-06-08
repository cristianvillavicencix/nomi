-- Saved Stripe customer + payment method for client invoice auto-debit.

alter table public.client_invoices
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_payment_method_id text,
  add column if not exists payment_method_brand text,
  add column if not exists payment_method_last4 text,
  add column if not exists last_auto_charge_error text;

comment on column public.client_invoices.stripe_customer_id is
  'Stripe Customer for this invoice payer (off-session remainder charges).';

comment on column public.client_invoices.stripe_payment_method_id is
  'Default Stripe PaymentMethod for scheduled remainder auto-debit.';

comment on column public.client_invoices.last_auto_charge_error is
  'Last failed auto-debit message (cleared on success).';

create index if not exists client_invoices_auto_charge_due_idx
  on public.client_invoices (org_id, status)
  where auto_charge_remainder = true
    and save_card_for_future_charges = true
    and stripe_customer_id is not null
    and stripe_payment_method_id is not null
    and status in ('sent', 'draft');

create table if not exists public.client_invoice_auto_charge_logs (
  id bigserial primary key,
  org_id bigint not null
    references public.organizations (id) on delete cascade,
  invoice_id bigint not null
    references public.client_invoices (id) on delete cascade,
  installment_number integer not null check (installment_number > 0),
  stripe_payment_intent_id text,
  amount_cents integer not null check (amount_cents > 0),
  status text not null
    check (status in ('processing', 'succeeded', 'failed', 'requires_action')),
  error_code text,
  error_message text,
  attempted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists client_invoice_auto_charge_logs_invoice_idx
  on public.client_invoice_auto_charge_logs (invoice_id, attempted_at desc);

alter table public.client_invoice_auto_charge_logs enable row level security;

grant select on public.client_invoice_auto_charge_logs to authenticated;
grant all on public.client_invoice_auto_charge_logs to service_role;

create policy "client_invoice_auto_charge_logs_org_scoped"
  on public.client_invoice_auto_charge_logs for select to authenticated
  using (org_id = public.current_user_org_id());
