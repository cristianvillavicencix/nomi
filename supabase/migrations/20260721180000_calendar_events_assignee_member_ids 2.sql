-- Multi-assignee support for calendar events (meetings, activities, follow-ups).

alter table public.calendar_events
  add column if not exists assignee_member_ids bigint[] not null default '{}';

create index if not exists calendar_events_assignee_member_ids_idx
  on public.calendar_events using gin (assignee_member_ids);

update public.calendar_events
set assignee_member_ids = array[organization_member_id]
where organization_member_id is not null
  and assignee_member_ids = '{}';

alter table public.calendar_events
  drop constraint if exists calendar_events_assignee_member_ids_check;

alter table public.calendar_events
  add constraint calendar_events_assignee_member_ids_check
  check (cardinality(assignee_member_ids) <= 10);

comment on column public.calendar_events.assignee_member_ids is
  'Internal team members assigned to this event. organization_member_id remains the primary host.';
