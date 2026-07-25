-- Meeting location type and address for calendar_events.

alter table public.calendar_events
  add column if not exists meeting_format text,
  add column if not exists location text;

alter table public.calendar_events
  drop constraint if exists calendar_events_meeting_format_check;

alter table public.calendar_events
  add constraint calendar_events_meeting_format_check
  check (
    meeting_format is null
    or meeting_format in ('video', 'phone', 'in_person', 'custom_link')
  );

comment on column public.calendar_events.meeting_format is
  'How the meeting happens: video, phone, in_person, or custom_link.';

comment on column public.calendar_events.location is
  'In-person address or optional phone-call notes.';

-- Legacy rows with a video link are treated as video meetings in the app.
update public.calendar_events
set meeting_format = 'video'
where meeting_format is null
  and meeting_url is not null
  and btrim(meeting_url) <> '';

create index if not exists calendar_events_meeting_format_idx
  on public.calendar_events (meeting_format)
  where meeting_format is not null;
