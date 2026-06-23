-- Link one client invoice to multiple tickets (bulk combined billing).

create table if not exists public.client_invoice_tickets (
  id bigserial primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  invoice_id bigint not null references public.client_invoices (id) on delete cascade,
  ticket_id bigint not null references public.tickets (id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (invoice_id, ticket_id)
);

create index if not exists client_invoice_tickets_invoice_idx
  on public.client_invoice_tickets (invoice_id);

create index if not exists client_invoice_tickets_ticket_idx
  on public.client_invoice_tickets (ticket_id);

alter table public.client_invoice_tickets enable row level security;

grant select, insert, update, delete on public.client_invoice_tickets to authenticated;
grant all on public.client_invoice_tickets to service_role;

create policy "client_invoice_tickets_select_scoped"
  on public.client_invoice_tickets for select to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('support.tickets.view')
  );

create policy "client_invoice_tickets_write_scoped"
  on public.client_invoice_tickets for all to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('support.tickets.manage')
  )
  with check (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('support.tickets.manage')
  );

drop trigger if exists trg_assign_org_id_client_invoice_tickets on public.client_invoice_tickets;
create trigger trg_assign_org_id_client_invoice_tickets
  before insert on public.client_invoice_tickets
  for each row execute function public.trg_assign_org_id_from_session();

comment on table public.client_invoice_tickets is
  'Many-to-many link when one invoice bills multiple tickets at once.';
