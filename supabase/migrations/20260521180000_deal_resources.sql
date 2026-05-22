-- Project resources: categorized images/files per deal (team uploads + client intake)

create table if not exists public.deal_resources (
  id bigserial primary key,
  org_id bigint not null references public.organizations (id),
  deal_id bigint not null references public.deals (id) on delete cascade,
  category text not null,
  label text,
  file jsonb not null,
  source text not null default 'team',
  organization_member_id bigint references public.organization_members (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists deal_resources_deal_id_idx on public.deal_resources (deal_id);
create index if not exists deal_resources_org_id_idx on public.deal_resources (org_id);
create index if not exists deal_resources_category_idx on public.deal_resources (deal_id, category);

alter table public.deal_resources enable row level security;

grant select, insert, update, delete on public.deal_resources to authenticated;
grant all on public.deal_resources to service_role;

create policy "Deal resources org scoped" on public.deal_resources
  for all to authenticated
  using (org_id = public.current_user_org_id())
  with check (org_id = public.current_user_org_id());

drop trigger if exists trg_assign_org_id_deal_resources on public.deal_resources;
create trigger trg_assign_org_id_deal_resources
  before insert on public.deal_resources
  for each row execute function public.trg_assign_org_id_from_session();
