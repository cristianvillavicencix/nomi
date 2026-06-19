-- Ticket supplement billing: pricing fields, deliverables, invoice link

alter table public.client_invoices
  add column if not exists ticket_id bigint references public.tickets (id) on delete set null;

create unique index if not exists client_invoices_ticket_uidx
  on public.client_invoices (ticket_id)
  where ticket_id is not null;

alter table public.tickets
  add column if not exists invoice_id bigint references public.client_invoices (id) on delete set null,
  add column if not exists billing_item_count integer not null default 0 check (billing_item_count >= 0),
  add column if not exists billing_has_roof boolean not null default false,
  add column if not exists billing_has_siding boolean not null default false,
  add column if not exists billing_has_esx boolean not null default false,
  add column if not exists billing_has_pdf_analysis boolean not null default false,
  add column if not exists delivery_status text not null default 'none'
    check (delivery_status in ('none', 'ready', 'invoice_sent', 'delivered')),
  add column if not exists delivered_at timestamptz;

create index if not exists tickets_invoice_id_idx
  on public.tickets (invoice_id)
  where invoice_id is not null;

create table if not exists public.ticket_deliverables (
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

create index if not exists ticket_deliverables_ticket_idx
  on public.ticket_deliverables (ticket_id, sort_order);

alter table public.ticket_deliverables enable row level security;

grant select, insert, update, delete on public.ticket_deliverables to authenticated;
grant all on public.ticket_deliverables to service_role;

create policy "ticket_deliverables_select_scoped"
  on public.ticket_deliverables for select to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('support.tickets.view')
  );

create policy "ticket_deliverables_write_scoped"
  on public.ticket_deliverables for all to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('support.tickets.manage')
  )
  with check (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('support.tickets.manage')
  );

drop trigger if exists trg_assign_org_id_ticket_deliverables on public.ticket_deliverables;
create trigger trg_assign_org_id_ticket_deliverables
  before insert on public.ticket_deliverables
  for each row execute function public.trg_assign_org_id_from_session();

comment on column public.tickets.delivery_status is
  'none: no deliverables; ready: files staged; invoice_sent: awaiting payment; delivered: sent after payment';

comment on column public.client_invoices.ticket_id is
  'When set, invoice payment triggers automatic delivery of ticket deliverables.';
