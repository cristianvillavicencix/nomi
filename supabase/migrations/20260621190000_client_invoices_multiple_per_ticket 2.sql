-- A ticket may have multiple client invoices (parallel billing cycles).
-- Keep ticket_id on each invoice for payment → auto-delivery; drop the one-invoice-per-ticket unique rule.

drop index if exists public.client_invoices_ticket_uidx;

create index if not exists client_invoices_ticket_id_idx
  on public.client_invoices (ticket_id)
  where ticket_id is not null;

comment on column public.client_invoices.ticket_id is
  'Ticket this invoice belongs to. Multiple invoices may reference the same ticket.';
