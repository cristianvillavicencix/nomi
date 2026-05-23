-- Audit trail for credential reveal, copy, and mutation.

create table if not exists public.deal_access_entry_audit (
  id bigint generated always as identity primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  entry_id bigint not null references public.deal_access_entries (id) on delete cascade,
  deal_id bigint not null references public.deals (id) on delete cascade,
  member_id bigint not null references public.organization_members (id) on delete cascade,
  action text not null check (
    action in ('viewed', 'copied', 'updated', 'created', 'deleted')
  ),
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_access_audit_entry
  on public.deal_access_entry_audit (entry_id, created_at desc);

create index if not exists idx_access_audit_member
  on public.deal_access_entry_audit (member_id, created_at desc);

alter table public.deal_access_entry_audit enable row level security;

grant select, insert on public.deal_access_entry_audit to authenticated;
grant all on public.deal_access_entry_audit to service_role;

create policy "access_audit_select" on public.deal_access_entry_audit
  for select to authenticated
  using (
    org_id = public.current_user_org_id()
    and (
      member_id = public.current_user_member_id()
      or public.current_member_has_capability('admin.users.manage')
    )
  );

create policy "access_audit_insert" on public.deal_access_entry_audit
  for insert to authenticated
  with check (
    org_id = public.current_user_org_id()
    and member_id = public.current_user_member_id()
  );
