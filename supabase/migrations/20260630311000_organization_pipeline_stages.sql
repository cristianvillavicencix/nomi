-- Per-organization customizable pipeline stages (LBS web agency default).

create table if not exists public.organization_pipeline_stages (
  id bigint generated always as identity primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  pipeline_id text not null default 'default',
  key text not null,
  label text not null,
  color text not null default '#64748b',
  order_index int not null,
  is_won boolean not null default false,
  is_lost boolean not null default false,
  created_at timestamptz not null default now(),
  unique (org_id, pipeline_id, key)
);

create index if not exists organization_pipeline_stages_org_pipeline_idx
  on public.organization_pipeline_stages (org_id, pipeline_id, order_index);

alter table public.organization_pipeline_stages enable row level security;

create policy "organization_pipeline_stages_select"
  on public.organization_pipeline_stages
  for select
  to authenticated
  using (org_id = public.current_user_org_id());

create policy "organization_pipeline_stages_insert"
  on public.organization_pipeline_stages
  for insert
  to authenticated
  with check (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('crm.pipeline.edit')
  );

create policy "organization_pipeline_stages_update"
  on public.organization_pipeline_stages
  for update
  to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('crm.pipeline.edit')
  )
  with check (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('crm.pipeline.edit')
  );

create policy "organization_pipeline_stages_delete"
  on public.organization_pipeline_stages
  for delete
  to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('crm.pipeline.edit')
  );

grant select, insert, update, delete on public.organization_pipeline_stages to authenticated;

insert into public.organization_pipeline_stages (
  org_id,
  pipeline_id,
  key,
  label,
  color,
  order_index,
  is_won,
  is_lost
)
select
  o.id,
  'default',
  s.key,
  s.label,
  s.color,
  s.order_index,
  s.is_won,
  s.is_lost
from public.organizations o
cross join (
  values
    ('lead', 'Lead', '#64748b', 1, false, false),
    ('discovery', 'Discovery', '#3b82f6', 2, false, false),
    ('proposal_sent', 'Proposal Sent', '#f59e0b', 3, false, false),
    ('won', 'Won', '#16a34a', 4, true, false),
    ('design', 'Design', '#9333ea', 5, false, false),
    ('development', 'Development', '#6366f1', 6, false, false),
    ('review', 'Client Review', '#f97316', 7, false, false),
    ('launch', 'Launch', '#0d9488', 8, false, false),
    ('maintenance', 'Maintenance', '#06b6d4', 9, false, false),
    ('closed_won', 'Closed Won', '#0f766e', 10, true, false),
    ('closed_lost', 'Closed Lost', '#dc2626', 11, false, true)
) as s (key, label, color, order_index, is_won, is_lost)
on conflict (org_id, pipeline_id, key) do nothing;
