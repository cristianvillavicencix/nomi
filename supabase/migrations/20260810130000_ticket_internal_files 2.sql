-- Internal ticket files (team only, never sent to client on delivery)

create table if not exists public.ticket_internal_files (
  id bigserial primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  ticket_id bigint not null references public.tickets (id) on delete cascade,
  title text not null,
  type text not null default 'application/octet-stream',
  path text not null,
  src text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ticket_internal_files_ticket_idx
  on public.ticket_internal_files (ticket_id, sort_order);

alter table public.ticket_internal_files enable row level security;

grant select, insert, update, delete on public.ticket_internal_files to authenticated;
grant all on public.ticket_internal_files to service_role;

create policy "ticket_internal_files_select_scoped"
  on public.ticket_internal_files for select to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('support.tickets.view')
  );

create policy "ticket_internal_files_write_scoped"
  on public.ticket_internal_files for all to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('support.tickets.manage')
  )
  with check (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('support.tickets.manage')
  );

drop trigger if exists trg_assign_org_id_ticket_internal_files on public.ticket_internal_files;
create trigger trg_assign_org_id_ticket_internal_files
  before insert on public.ticket_internal_files
  for each row execute function public.trg_assign_org_id_from_session();
