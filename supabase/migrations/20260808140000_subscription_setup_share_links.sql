-- Short share links for subscription Stripe setup (SMS/email), like /iv/ for invoices.

alter table public.client_subscriptions
  add column if not exists stripe_payment_method_id text,
  add column if not exists setup_short_code text,
  add column if not exists setup_share_url text;

create table if not exists public.public_client_subscription_setup_tokens (
  id bigint generated always as identity primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  subscription_id bigint not null references public.client_subscriptions (id) on delete cascade,
  short_code text not null unique,
  checkout_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subscription_id)
);

create index if not exists public_client_subscription_setup_tokens_short_code_idx
  on public.public_client_subscription_setup_tokens (short_code);

alter table public.public_client_subscription_setup_tokens enable row level security;

grant select, insert, update, delete on public.public_client_subscription_setup_tokens to service_role;

comment on table public.public_client_subscription_setup_tokens is
  'Public short links (/sub/:code) that redirect to the latest Stripe checkout session for subscription setup.';

comment on column public.client_subscriptions.setup_share_url is
  'Nomi short URL (e.g. /sub/abc123) included in setup link emails/SMS.';
