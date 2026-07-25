-- Per-member read cursor for ticket inbox (unread highlights in list + thread).

create table if not exists public.ticket_member_reads (
  id bigserial primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  ticket_id bigint not null references public.tickets (id) on delete cascade,
  member_id bigint not null references public.organization_members (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ticket_id, member_id)
);

create index if not exists ticket_member_reads_member_idx
  on public.ticket_member_reads (member_id, ticket_id);

create index if not exists ticket_member_reads_ticket_idx
  on public.ticket_member_reads (ticket_id);

alter table public.ticket_member_reads enable row level security;

grant select, insert, update, delete on public.ticket_member_reads to authenticated;
grant all on public.ticket_member_reads to service_role;

create policy "ticket_member_reads_select_own" on public.ticket_member_reads
  for select to authenticated
  using (
    org_id = public.current_user_org_id()
    and member_id = public.current_user_member_id()
    and public.current_member_has_capability('support.tickets.view')
  );

create policy "ticket_member_reads_insert_own" on public.ticket_member_reads
  for insert to authenticated
  with check (
    org_id = public.current_user_org_id()
    and member_id = public.current_user_member_id()
    and public.current_member_has_capability('support.tickets.view')
  );

create policy "ticket_member_reads_update_own" on public.ticket_member_reads
  for update to authenticated
  using (
    org_id = public.current_user_org_id()
    and member_id = public.current_user_member_id()
    and public.current_member_has_capability('support.tickets.view')
  )
  with check (
    org_id = public.current_user_org_id()
    and member_id = public.current_user_member_id()
  );

create or replace function public.sync_ticket_member_read_org()
returns trigger
language plpgsql
as $$
declare
  v_org_id bigint;
begin
  select t.org_id
  into v_org_id
  from public.tickets t
  where t.id = new.ticket_id;

  if v_org_id is null then
    raise exception 'Ticket % not found for read state', new.ticket_id;
  end if;

  new.org_id := v_org_id;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ticket_member_reads_sync_org on public.ticket_member_reads;

create trigger ticket_member_reads_sync_org
before insert or update on public.ticket_member_reads
for each row
execute function public.sync_ticket_member_read_org();

comment on table public.ticket_member_reads is
  'Tracks when each team member last viewed a ticket thread (inbox unread state).';
