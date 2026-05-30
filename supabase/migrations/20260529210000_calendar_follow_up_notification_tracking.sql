-- Track SMS notifications for lead follow-up calendar events.

alter table public.calendar_events
  add column if not exists follow_up_scheduled_notified_at timestamptz,
  add column if not exists follow_up_reminder_sent_at timestamptz;

comment on column public.calendar_events.follow_up_scheduled_notified_at is
  'When the assignee was SMS-notified that this follow-up was scheduled.';
comment on column public.calendar_events.follow_up_reminder_sent_at is
  'When the assignee was SMS-reminded before this follow-up (remind_before_minutes).';

create index if not exists calendar_events_follow_up_reminder_pending_idx
  on public.calendar_events (event_date, event_time)
  where contact_id is not null
    and completed_at is null
    and follow_up_reminder_sent_at is null;
