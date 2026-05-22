alter table public.tasks
  add column if not exists created_at timestamptz;

update public.tasks
set created_at = coalesce(done_date, due_date, now())
where created_at is null;

alter table public.tasks
  alter column created_at set default now(),
  alter column created_at set not null;

create index if not exists tasks_created_at_idx on public.tasks (created_at);
