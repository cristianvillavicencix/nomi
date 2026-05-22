-- Add person_id to calendar_events when table was created before person linking existed.

alter table public.calendar_events
  add column if not exists person_id bigint references public.people(id) on update cascade on delete set null;

create index if not exists calendar_events_person_id_idx
  on public.calendar_events (person_id)
  where person_id is not null;

create index if not exists calendar_events_contact_id_idx
  on public.calendar_events (contact_id)
  where contact_id is not null;
