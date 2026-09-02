-- Track when signed agreement + receipt PDFs were emailed to the client.
alter table public.client_subscriptions
  add column if not exists agreement_completion_emailed_at timestamptz;

comment on column public.client_subscriptions.agreement_completion_emailed_at is
  'When the signed agreement and setup receipt PDFs were emailed after card setup.';
