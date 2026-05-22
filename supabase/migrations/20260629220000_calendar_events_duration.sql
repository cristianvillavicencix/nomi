-- Calendar events: optional duration in minutes (for meetings and timed events).

alter table public.calendar_events
  add column if not exists duration_minutes integer
    check (duration_minutes is null or duration_minutes > 0);
