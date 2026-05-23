-- Project milestones for timeline / schedule tab.

create table if not exists public.deal_milestones (
  id bigint generated always as identity primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  deal_id bigint not null references public.deals (id) on delete cascade,
  title text not null,
  description text,
  start_date date,
  due_date date,
  completed_at timestamptz,
  order_index int not null default 0,
  depends_on_milestone_id bigint references public.deal_milestones (id) on delete set null,
  color text not null default '#3b82f6',
  created_at timestamptz not null default now()
);

create index if not exists deal_milestones_deal_idx
  on public.deal_milestones (deal_id, order_index);

alter table public.deal_milestones enable row level security;
grant select, insert, update, delete on public.deal_milestones to authenticated;

create policy "deal_milestones_select"
  on public.deal_milestones for select to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.can_view_deal(deal_id)
  );

create policy "deal_milestones_insert"
  on public.deal_milestones for insert to authenticated
  with check (
    org_id = public.current_user_org_id()
    and public.can_view_deal(deal_id)
    and public.current_member_has_capability('crm.pipeline.edit')
  );

create policy "deal_milestones_update"
  on public.deal_milestones for update to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.can_view_deal(deal_id)
    and public.current_member_has_capability('crm.pipeline.edit')
  )
  with check (
    org_id = public.current_user_org_id()
    and public.can_view_deal(deal_id)
  );

create policy "deal_milestones_delete"
  on public.deal_milestones for delete to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.can_view_deal(deal_id)
    and public.current_member_has_capability('crm.pipeline.edit')
  );
