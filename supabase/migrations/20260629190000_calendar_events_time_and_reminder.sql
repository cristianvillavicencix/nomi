-- Calendar events: specific time and remind-before offset.

alter table public.calendar_events
  add column if not exists event_time time,
  add column if not exists remind_before_minutes integer
    check (remind_before_minutes is null or remind_before_minutes >= 0);

create index if not exists calendar_events_event_time_idx
  on public.calendar_events (event_date, event_time)
  where event_time is not null;
