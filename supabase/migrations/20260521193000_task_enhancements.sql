-- Task enhancements: priority and internal flag

alter table public.tasks
  add column if not exists priority text not null default 'normal',
  add column if not exists internal boolean not null default false;

create index if not exists tasks_deal_id_open_idx on public.tasks (deal_id)
  where done_date is null;

create index if not exists tasks_org_member_open_idx on public.tasks (organization_member_id)
  where done_date is null;
