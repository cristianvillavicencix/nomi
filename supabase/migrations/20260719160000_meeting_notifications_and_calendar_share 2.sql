-- Meeting notification org defaults, send tracking, and public calendar share tokens.

alter table public.organizations
  add column if not exists meeting_notification_settings jsonb not null default jsonb_build_object(
    'host_confirmation_on_create', true,
    'client_invite_email_default', true,
    'client_invite_sms_default', true,
    'remind_host_at_15', true,
    'remind_host_at_5', true,
    'remind_client_at_15', true,
    'remind_client_at_5', true,
    'include_add_to_calendar_link', true
  );

comment on column public.organizations.meeting_notification_settings is
  'Video call / meeting notification defaults: host confirm, client invite channels, 15/5 reminders, add-to-calendar links.';

alter table public.calendar_events
  add column if not exists host_confirmation_sent_at timestamptz,
  add column if not exists meeting_client_invite_sent_at timestamptz,
  add column if not exists host_reminder_15_sent_at timestamptz,
  add column if not exists host_reminder_5_sent_at timestamptz,
  add column if not exists client_reminder_15_sent_at timestamptz,
  add column if not exists client_reminder_5_sent_at timestamptz;

comment on column public.calendar_events.host_confirmation_sent_at is
  'When host SMS confirmation was sent for a scheduled video meeting.';
comment on column public.calendar_events.meeting_client_invite_sent_at is
  'When client invite (email and/or SMS) was sent for a video meeting.';
comment on column public.calendar_events.host_reminder_15_sent_at is
  'Host SMS reminder ~15 minutes before meeting start.';
comment on column public.calendar_events.host_reminder_5_sent_at is
  'Host SMS reminder ~5 minutes before meeting start.';
comment on column public.calendar_events.client_reminder_15_sent_at is
  'Client SMS reminder ~15 minutes before meeting start.';
comment on column public.calendar_events.client_reminder_5_sent_at is
  'Client SMS reminder ~5 minutes before meeting start.';

create index if not exists calendar_events_meeting_reminder_pending_idx
  on public.calendar_events (event_date, event_time)
  where completed_at is null
    and meeting_url is not null
    and contact_id is not null
    and organization_member_id is not null
    and (
      host_reminder_15_sent_at is null
      or host_reminder_5_sent_at is null
      or client_reminder_15_sent_at is null
      or client_reminder_5_sent_at is null
    );

create table if not exists public.public_calendar_event_tokens (
  id bigint generated always as identity primary key,
  token text not null unique,
  short_code text not null unique,
  org_id bigint not null references public.organizations (id) on delete cascade,
  calendar_event_id bigint not null references public.calendar_events (id) on delete cascade,
  created_by_member_id bigint references public.organization_members (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (calendar_event_id)
);

create index if not exists public_calendar_event_tokens_token_idx
  on public.public_calendar_event_tokens (token);

create index if not exists public_calendar_event_tokens_short_code_idx
  on public.public_calendar_event_tokens (short_code);

alter table public.public_calendar_event_tokens enable row level security;

grant select, insert, update, delete on public.public_calendar_event_tokens to authenticated;
grant all on public.public_calendar_event_tokens to service_role;

create policy "public_calendar_event_tokens_org_scoped"
  on public.public_calendar_event_tokens for all to authenticated
  using (org_id = public.current_user_org_id())
  with check (org_id = public.current_user_org_id());

comment on table public.public_calendar_event_tokens is
  'Public short links for add-to-calendar pages for CRM video meetings.';
