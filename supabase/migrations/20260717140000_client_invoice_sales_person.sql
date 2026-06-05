-- Sales person assigned to a client invoice

alter table public.client_invoices
  add column if not exists sales_person_id bigint
    references public.organization_members (id) on delete set null;

create index if not exists client_invoices_sales_person_idx
  on public.client_invoices (sales_person_id)
  where sales_person_id is not null;

comment on column public.client_invoices.sales_person_id is
  'Organization member shown as the sales person on the invoice.';
