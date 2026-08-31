-- Agreement enrollment beside Direct (default). Non-breaking.

alter table public.client_subscriptions
  add column if not exists enrollment_mode text not null default 'direct',
  add column if not exists agreement_terms_markdown text,
  add column if not exists agreement_terms_version text,
  add column if not exists agreement_signed_at timestamptz,
  add column if not exists agreement_signatory_name text,
  add column if not exists agreement_signature_png text,
  add column if not exists agreement_signed_ip text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'client_subscriptions_enrollment_mode_check'
  ) then
    alter table public.client_subscriptions
      add constraint client_subscriptions_enrollment_mode_check
      check (enrollment_mode in ('direct', 'agreement'));
  end if;
end $$;

alter table public.public_client_subscription_setup_tokens
  add column if not exists purpose text not null default 'setup';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'public_client_subscription_setup_tokens_purpose_check'
  ) then
    alter table public.public_client_subscription_setup_tokens
      add constraint public_client_subscription_setup_tokens_purpose_check
      check (purpose in ('setup', 'agreement'));
  end if;
end $$;

-- Agreement tokens are issued before Stripe Checkout exists.
alter table public.public_client_subscription_setup_tokens
  alter column checkout_url drop not null;

comment on column public.client_subscriptions.enrollment_mode is
  'direct = existing create/payment paths; agreement = client signs then adds card.';
comment on column public.client_subscriptions.agreement_terms_markdown is
  'Frozen terms shown on the public agreement page.';
comment on column public.public_client_subscription_setup_tokens.purpose is
  'setup = /sub/:code Stripe redirect; agreement = /sub-agree/:code portal.';
