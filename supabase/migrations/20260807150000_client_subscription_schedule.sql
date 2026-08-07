-- Add optional schedule fields for client subscriptions (start / end dates).

alter table public.client_subscriptions
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz;

comment on column public.client_subscriptions.starts_at is
  'Planned subscription start; future dates use Stripe trial until first charge.';

comment on column public.client_subscriptions.ends_at is
  'Planned subscription end; mapped to Stripe cancel_at when set.';
