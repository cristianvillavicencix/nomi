-- Timed pause support: Stripe pause_collection.resumes_at mirrored for UI.
alter table public.client_subscriptions
  add column if not exists pause_resumes_at timestamptz;

comment on column public.client_subscriptions.pause_resumes_at is
  'When a timed pause ends and Stripe resumes auto-charging (null = until manual resume).';
