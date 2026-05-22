-- Video call link (Jitsi room URL) on calendar events.

alter table public.calendar_events
  add column if not exists meeting_url text;

create index if not exists calendar_events_meeting_url_idx
  on public.calendar_events (event_date)
  where meeting_url is not null;
