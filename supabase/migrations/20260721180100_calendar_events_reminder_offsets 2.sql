-- Up to 3 reminder offsets per calendar event.

alter table public.calendar_events
  add column if not exists reminder_offsets_minutes integer[] not null default '{}',
  add column if not exists reminder_sent_at timestamptz[] not null default '{}';

update public.calendar_events
set reminder_offsets_minutes = array[remind_before_minutes]
where remind_before_minutes is not null
  and reminder_offsets_minutes = '{}';

alter table public.calendar_events
  drop constraint if exists calendar_events_reminder_offsets_check;

alter table public.calendar_events
  add constraint calendar_events_reminder_offsets_check
  check (
    cardinality(reminder_offsets_minutes) <= 3
    and cardinality(reminder_sent_at) <= 3
  );

comment on column public.calendar_events.reminder_offsets_minutes is
  'Minutes before event start for each reminder (max 3). Legacy remind_before_minutes is deprecated.';

comment on column public.calendar_events.reminder_sent_at is
  'Parallel array tracking when each reminder offset was sent.';
