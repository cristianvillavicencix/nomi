-- Audit trail for subscription agreement / setup emails and SMS.

create table if not exists public.client_subscription_delivery_logs (
  id bigint generated always as identity primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  subscription_id bigint not null references public.client_subscriptions (id) on delete cascade,
  channel text not null check (channel in ('email', 'sms')),
  purpose text not null check (
    purpose in ('agreement_invite', 'agreement_completion', 'setup_link')
  ),
  to_address text not null,
  subject text,
  body_preview text,
  status text not null default 'sent' check (status in ('sent', 'skipped', 'failed')),
  provider_id text,
  error_message text,
  created_by bigint references public.organization_members (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists client_subscription_delivery_logs_sub_created_idx
  on public.client_subscription_delivery_logs (subscription_id, created_at desc);

create index if not exists client_subscription_delivery_logs_org_created_idx
  on public.client_subscription_delivery_logs (org_id, created_at desc);

alter table public.client_subscription_delivery_logs enable row level security;

grant select on public.client_subscription_delivery_logs to authenticated;
grant all on public.client_subscription_delivery_logs to service_role;

create policy "client_subscription_delivery_logs_org_scoped"
  on public.client_subscription_delivery_logs for select to authenticated
  using (
    org_id in (
      select org_id from public.organization_members where user_id = auth.uid()
    )
  );

comment on table public.client_subscription_delivery_logs is
  'Outbound email/SMS for subscription agreement invites, completion docs, and setup links.';

alter table public.client_subscriptions
  add column if not exists agreement_invite_sent_at timestamptz;

comment on column public.client_subscriptions.agreement_invite_sent_at is
  'When the agreement invite email and/or SMS was last delivered successfully.';
