-- Client invoices (Phase 2 billing): numbered invoices linked to proposal installments

create table if not exists public.organization_client_invoice_sequences (
  org_id bigint not null references public.organizations (id) on delete cascade,
  year integer not null,
  last_number integer not null default 0 check (last_number >= 0),
  primary key (org_id, year)
);

create or replace function public.next_client_invoice_number(p_org_id bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer := extract(year from current_date)::integer;
  v_next integer;
begin
  insert into public.organization_client_invoice_sequences (org_id, year, last_number)
  values (p_org_id, v_year, 0)
  on conflict (org_id, year) do nothing;

  update public.organization_client_invoice_sequences
  set last_number = last_number + 1
  where org_id = p_org_id and year = v_year
  returning last_number into v_next;

  return 'INV-' || v_year::text || '-' || lpad(v_next::text, 4, '0');
end;
$$;

grant execute on function public.next_client_invoice_number(bigint) to service_role;

create table if not exists public.client_invoices (
  id bigserial primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  invoice_number text not null,
  installment_id bigint references public.proposal_payment_installments (id) on delete set null,
  proposal_id bigint references public.proposals (id) on delete set null,
  deal_id bigint references public.deals (id) on delete set null,
  company_id bigint references public.companies (id) on delete set null,
  contact_id bigint references public.contacts (id) on delete set null,
  issue_date date not null default current_date,
  due_date date not null,
  amount numeric(12, 2) not null default 0,
  currency text not null default 'USD',
  description text not null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'paid', 'void', 'overdue')),
  sent_at timestamptz,
  paid_at timestamptz,
  stripe_payment_intent_id text,
  recipient_email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, invoice_number)
);

create unique index if not exists client_invoices_installment_uidx
  on public.client_invoices (installment_id)
  where installment_id is not null;

create index if not exists client_invoices_org_status_idx
  on public.client_invoices (org_id, status);

create index if not exists client_invoices_org_due_date_idx
  on public.client_invoices (org_id, due_date desc);

alter table public.client_invoices enable row level security;

grant select, insert, update on public.client_invoices to authenticated;
grant all on public.client_invoices to service_role;
grant select, insert, update on public.organization_client_invoice_sequences to service_role;

create policy "client_invoices_org_scoped"
  on public.client_invoices for all to authenticated
  using (org_id = public.current_user_org_id())
  with check (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('proposals.view')
  );

drop trigger if exists trg_assign_org_id_client_invoices on public.client_invoices;
create trigger trg_assign_org_id_client_invoices
  before insert on public.client_invoices
  for each row execute function public.trg_assign_org_id_from_session();

comment on table public.client_invoices is
  'Numbered client invoices, typically one per proposal payment installment.';
