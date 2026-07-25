-- Marketing campaigns: SMS/email opt-in preferences, campaign tables, org settings.

alter table public.organization_messaging_settings
  add column if not exists twilio_marketing_messaging_service_sid text,
  add column if not exists twilio_marketing_phone_number text,
  add column if not exists marketing_email_from text;

comment on column public.organization_messaging_settings.twilio_marketing_messaging_service_sid is
  'Twilio Messaging Service SID for 10DLC marketing SMS (bulk promos).';
comment on column public.organization_messaging_settings.twilio_marketing_phone_number is
  'Optional dedicated marketing sender number when not using a Messaging Service.';
comment on column public.organization_messaging_settings.marketing_email_from is
  'Optional From address for marketing email blasts (Twilio Email).';

create table if not exists public.contact_marketing_preferences (
  contact_id bigint primary key references public.contacts (id) on delete cascade,
  org_id bigint not null references public.organizations (id) on delete cascade,
  phone_e164 text,
  email text,
  sms_marketing_opt_in_at timestamptz,
  sms_marketing_opt_in_source text,
  sms_marketing_opt_out_at timestamptz,
  sms_marketing_opt_out_reason text,
  email_marketing_opt_in_at timestamptz,
  email_marketing_opt_in_source text,
  email_marketing_opt_out_at timestamptz,
  email_marketing_opt_out_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contact_marketing_preferences_org_idx
  on public.contact_marketing_preferences (org_id);

create index if not exists contact_marketing_preferences_phone_idx
  on public.contact_marketing_preferences (org_id, phone_e164)
  where phone_e164 is not null;

create table if not exists public.sms_marketing_suppressions (
  id bigserial primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  phone_e164 text not null,
  opted_out_at timestamptz not null default now(),
  reason text,
  contact_id bigint references public.contacts (id) on delete set null,
  unique (org_id, phone_e164)
);

create index if not exists sms_marketing_suppressions_org_phone_idx
  on public.sms_marketing_suppressions (org_id, phone_e164);

create table if not exists public.sms_campaigns (
  id bigserial primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  name text not null,
  body text not null,
  status text not null default 'draft'
    check (status in ('draft', 'building', 'ready', 'sending', 'sent', 'failed', 'cancelled')),
  audience_filter jsonb not null default '{}'::jsonb,
  include_stop_footer boolean not null default true,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_by_member_id bigint references public.organization_members (id) on delete set null,
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  skipped_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sms_campaigns_org_status_idx
  on public.sms_campaigns (org_id, status, updated_at desc);

create table if not exists public.sms_campaign_recipients (
  id bigserial primary key,
  campaign_id bigint not null references public.sms_campaigns (id) on delete cascade,
  org_id bigint not null references public.organizations (id) on delete cascade,
  contact_id bigint references public.contacts (id) on delete set null,
  phone_e164 text not null,
  status text not null default 'pending'
    check (status in ('pending', 'queued', 'sent', 'delivered', 'failed', 'skipped')),
  external_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, phone_e164)
);

create index if not exists sms_campaign_recipients_campaign_status_idx
  on public.sms_campaign_recipients (campaign_id, status);

create table if not exists public.email_campaigns (
  id bigserial primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  name text not null,
  subject text not null,
  body_html text not null,
  body_text text,
  status text not null default 'draft'
    check (status in ('draft', 'building', 'ready', 'sending', 'sent', 'failed', 'cancelled')),
  audience_filter jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_by_member_id bigint references public.organization_members (id) on delete set null,
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  skipped_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_campaigns_org_status_idx
  on public.email_campaigns (org_id, status, updated_at desc);

create table if not exists public.email_campaign_recipients (
  id bigserial primary key,
  campaign_id bigint not null references public.email_campaigns (id) on delete cascade,
  org_id bigint not null references public.organizations (id) on delete cascade,
  contact_id bigint references public.contacts (id) on delete set null,
  email text not null,
  unsubscribe_token uuid not null default gen_random_uuid(),
  status text not null default 'pending'
    check (status in ('pending', 'queued', 'sent', 'failed', 'skipped', 'unsubscribed')),
  external_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, email)
);

create index if not exists email_campaign_recipients_campaign_status_idx
  on public.email_campaign_recipients (campaign_id, status);

create index if not exists email_campaign_recipients_unsubscribe_token_idx
  on public.email_campaign_recipients (unsubscribe_token);

-- RLS
alter table public.contact_marketing_preferences enable row level security;
alter table public.sms_marketing_suppressions enable row level security;
alter table public.sms_campaigns enable row level security;
alter table public.sms_campaign_recipients enable row level security;
alter table public.email_campaigns enable row level security;
alter table public.email_campaign_recipients enable row level security;

grant all on public.contact_marketing_preferences to authenticated, service_role;
grant all on public.sms_marketing_suppressions to authenticated, service_role;
grant all on public.sms_campaigns to authenticated, service_role;
grant all on public.sms_campaign_recipients to authenticated, service_role;
grant all on public.email_campaigns to authenticated, service_role;
grant all on public.email_campaign_recipients to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

drop policy if exists "contact_marketing_preferences_org" on public.contact_marketing_preferences;
create policy "contact_marketing_preferences_org" on public.contact_marketing_preferences
  for all to authenticated
  using (org_id = public.current_user_org_id())
  with check (org_id = public.current_user_org_id());

drop policy if exists "sms_marketing_suppressions_org" on public.sms_marketing_suppressions;
create policy "sms_marketing_suppressions_org" on public.sms_marketing_suppressions
  for all to authenticated
  using (org_id = public.current_user_org_id())
  with check (org_id = public.current_user_org_id());

drop policy if exists "sms_campaigns_org" on public.sms_campaigns;
create policy "sms_campaigns_org" on public.sms_campaigns
  for all to authenticated
  using (org_id = public.current_user_org_id())
  with check (org_id = public.current_user_org_id());

drop policy if exists "sms_campaign_recipients_org" on public.sms_campaign_recipients;
create policy "sms_campaign_recipients_org" on public.sms_campaign_recipients
  for all to authenticated
  using (org_id = public.current_user_org_id())
  with check (org_id = public.current_user_org_id());

drop policy if exists "email_campaigns_org" on public.email_campaigns;
create policy "email_campaigns_org" on public.email_campaigns
  for all to authenticated
  using (org_id = public.current_user_org_id())
  with check (org_id = public.current_user_org_id());

drop policy if exists "email_campaign_recipients_org" on public.email_campaign_recipients;
create policy "email_campaign_recipients_org" on public.email_campaign_recipients
  for all to authenticated
  using (org_id = public.current_user_org_id())
  with check (org_id = public.current_user_org_id());
