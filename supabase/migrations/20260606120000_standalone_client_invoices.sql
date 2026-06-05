-- Standalone client invoices: line items, fees, terms, save-card flag

alter table public.client_invoices
  add column if not exists subtotal numeric(12, 2),
  add column if not exists fee_amount numeric(12, 2) not null default 0,
  add column if not exists terms text not null default 'Net 30',
  add column if not exists save_card_for_future_charges boolean not null default false;

comment on column public.client_invoices.save_card_for_future_charges is
  'When true, client payment flow should save card on file for future off-session charges.';

create table if not exists public.client_invoice_line_items (
  id bigserial primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  invoice_id bigint not null references public.client_invoices (id) on delete cascade,
  description text not null,
  quantity numeric(12, 2) not null default 1 check (quantity > 0),
  unit text not null default 'ea',
  unit_price numeric(12, 2) not null default 0 check (unit_price >= 0),
  line_total numeric(12, 2) not null default 0 check (line_total >= 0),
  package_id bigint references public.service_packages (id) on delete set null,
  addon_id bigint references public.service_addons (id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists client_invoice_line_items_invoice_idx
  on public.client_invoice_line_items (invoice_id, sort_order);

alter table public.client_invoice_line_items enable row level security;

grant select, insert, update, delete on public.client_invoice_line_items to authenticated;
grant all on public.client_invoice_line_items to service_role;

create policy "client_invoice_line_items_org_scoped"
  on public.client_invoice_line_items for all to authenticated
  using (org_id = public.current_user_org_id())
  with check (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('proposals.view')
  );

drop trigger if exists trg_assign_org_id_client_invoice_line_items
  on public.client_invoice_line_items;
create trigger trg_assign_org_id_client_invoice_line_items
  before insert on public.client_invoice_line_items
  for each row execute function public.trg_assign_org_id_from_session();

comment on table public.client_invoice_line_items is
  'Line items for standalone or proposal-linked client invoices.';
