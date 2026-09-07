-- Stripe webhook idempotency: persist event.id and skip duplicates.

create table if not exists public.stripe_processed_events (
  event_id text primary key,
  source text not null,
  event_type text,
  processed_at timestamptz not null default now()
);

comment on table public.stripe_processed_events is
  'Stripe event.id values already handled by stripe-webhook / stripe-client-webhook.';

create index if not exists stripe_processed_events_processed_at_idx
  on public.stripe_processed_events (processed_at desc);

alter table public.stripe_processed_events enable row level security;

revoke all on table public.stripe_processed_events from public, anon, authenticated;
grant all on table public.stripe_processed_events to service_role;
