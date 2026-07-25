-- Distinguish task tag notifications (mention vs due-date reschedule).
alter table public.task_tag_notifications
  add column if not exists kind text not null default 'mention';

alter table public.task_tag_notifications
  drop constraint if exists task_tag_notifications_kind_check;

alter table public.task_tag_notifications
  add constraint task_tag_notifications_kind_check
  check (kind in ('mention', 'due_date_rescheduled'));
