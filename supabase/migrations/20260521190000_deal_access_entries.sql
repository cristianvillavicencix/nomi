-- Project access credentials: URLs, usernames, and passwords per deal

create table if not exists public.deal_access_entries (
  id bigserial primary key,
  org_id bigint not null references public.organizations (id),
  deal_id bigint not null references public.deals (id) on delete cascade,
  label text not null,
  url text,
  username text,
  password text,
  notes text,
  organization_member_id bigint references public.organization_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deal_access_entries_deal_id_idx on public.deal_access_entries (deal_id);
create index if not exists deal_access_entries_org_id_idx on public.deal_access_entries (org_id);

alter table public.deal_access_entries enable row level security;

grant select, insert, update, delete on public.deal_access_entries to authenticated;
grant all on public.deal_access_entries to service_role;

create policy "Deal access entries org scoped" on public.deal_access_entries
  for all to authenticated
  using (org_id = public.current_user_org_id())
  with check (org_id = public.current_user_org_id());

drop trigger if exists trg_assign_org_id_deal_access_entries on public.deal_access_entries;
create trigger trg_assign_org_id_deal_access_entries
  before insert on public.deal_access_entries
  for each row execute function public.trg_assign_org_id_from_session();
