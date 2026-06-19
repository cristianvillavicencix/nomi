-- Track which deliverables belong to which invoice cycle (supports re-billing a ticket).

alter table public.ticket_deliverables
  add column if not exists invoiced_invoice_id bigint
    references public.client_invoices (id) on delete set null,
  add column if not exists delivered_at timestamptz;

create index if not exists ticket_deliverables_invoiced_invoice_idx
  on public.ticket_deliverables (invoiced_invoice_id)
  where invoiced_invoice_id is not null;

-- Backfill: files on tickets that already have a sent/paid invoice were billed on that invoice.
update public.ticket_deliverables td
set invoiced_invoice_id = t.invoice_id
from public.tickets t
where td.ticket_id = t.id
  and t.invoice_id is not null
  and td.invoiced_invoice_id is null;

update public.ticket_deliverables td
set delivered_at = t.delivered_at
from public.tickets t
where td.ticket_id = t.id
  and t.delivered_at is not null
  and td.invoiced_invoice_id = t.invoice_id
  and td.delivered_at is null;

comment on column public.ticket_deliverables.invoiced_invoice_id is
  'Invoice that billed this file. Null until the invoice is sent.';

comment on column public.ticket_deliverables.delivered_at is
  'When this file was emailed to the client after payment.';
