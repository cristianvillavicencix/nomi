-- Client recurring subscriptions (Stripe auto-charge), managed from Billing → Subscriptions.

create table if not exists public.client_subscriptions (
  id bigint generated always as identity primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  company_id bigint references public.companies (id) on delete set null,
  contact_id bigint references public.contacts (id) on delete set null,
  deal_id bigint references public.deals (id) on delete set null,
  name text not null,
  description text,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'USD',
  billing_interval text not null
    check (billing_interval in ('weekly', 'monthly', 'yearly')),
  line_items jsonb not null default '[]'::jsonb,
  status text not null default 'pending_setup'
    check (
      status in (
        'pending_setup',
        'active',
        'past_due',
        'paused',
        'canceled',
        'trialing'
      )
    ),
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_checkout_session_id text,
  payment_method_brand text,
  payment_method_last4 text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  next_billing_at timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  paused_at timestamptz,
  setup_checkout_url text,
  created_by_member_id bigint references public.organization_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_subscriptions_org_status_idx
  on public.client_subscriptions (org_id, status);

create index if not exists client_subscriptions_org_company_idx
  on public.client_subscriptions (org_id, company_id);

create index if not exists client_subscriptions_org_contact_idx
  on public.client_subscriptions (org_id, contact_id);

create unique index if not exists client_subscriptions_stripe_sub_uidx
  on public.client_subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

alter table public.client_invoices
  add column if not exists subscription_id bigint references public.client_subscriptions (id) on delete set null,
  add column if not exists stripe_subscription_invoice_id text;

create unique index if not exists client_invoices_stripe_subscription_invoice_uidx
  on public.client_invoices (org_id, stripe_subscription_invoice_id)
  where stripe_subscription_invoice_id is not null;

create index if not exists client_invoices_subscription_id_idx
  on public.client_invoices (subscription_id)
  where subscription_id is not null;

comment on table public.client_subscriptions is
  'Client recurring billing plans (hosting, SEO, etc.) with Stripe auto-charge.';

comment on column public.client_invoices.subscription_id is
  'When set, this invoice was generated from a client subscription billing cycle.';

comment on column public.client_invoices.stripe_subscription_invoice_id is
  'Stripe Invoice id for subscription cycle charges; used for webhook idempotency.';

alter table public.client_subscriptions enable row level security;

grant select, insert, update, delete on public.client_subscriptions to authenticated;
grant all on public.client_subscriptions to service_role;

create policy "client_subscriptions_select"
  on public.client_subscriptions for select to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('proposals.view')
  );

create policy "client_subscriptions_insert"
  on public.client_subscriptions for insert to authenticated
  with check (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('proposals.view')
  );

create policy "client_subscriptions_update"
  on public.client_subscriptions for update to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('proposals.view')
  )
  with check (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('proposals.view')
  );

create policy "client_subscriptions_delete"
  on public.client_subscriptions for delete to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('proposals.view')
  );
