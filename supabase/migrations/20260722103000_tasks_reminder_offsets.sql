-- Optional due-date alerts for tasks (same shape as calendar_events.reminder_offsets_minutes).

alter table public.tasks
  add column if not exists reminder_offsets_minutes integer[] not null default '{}';

alter table public.tasks
  drop constraint if exists tasks_reminder_offsets_check;

alter table public.tasks
  add constraint tasks_reminder_offsets_check
  check (
    cardinality(reminder_offsets_minutes) <= 3
    and reminder_offsets_minutes <@ array[0, 5, 15, 30, 60, 120, 1440]::integer[]
  );

comment on column public.tasks.reminder_offsets_minutes is
  'Minutes before due date/time to notify assignees (max 3). Empty = no alert.';
