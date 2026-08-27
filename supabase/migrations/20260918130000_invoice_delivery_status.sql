-- Add delivery status tracking to client_invoices for visible intermediate states
create type invoice_delivery_status as enum (
  'pending_payment',
  'payment_processing',
  'payment_received',
  'delivering_files',
  'delivery_succeeded',
  'delivery_failed',
  'delivery_manually_sent'
);

alter table public.client_invoices
  add column if not exists delivery_status invoice_delivery_status default 'pending_payment',
  add column if not exists delivery_status_at timestamptz default null,
  add column if not exists delivery_error_message text default null;

comment on column public.client_invoices.delivery_status is 'Current stage of file delivery after payment';
comment on column public.client_invoices.delivery_status_at is 'Last time the delivery_status changed';
comment on column public.client_invoices.delivery_error_message is 'Human-readable error if delivery_status is delivery_failed';

-- Backfill existing paid invoices to delivery_succeeded where payment was completed
update public.client_invoices
  set delivery_status = 'delivery_succeeded',
      delivery_status_at = coalesce(updated_at, created_at)
where status = 'paid'
  and delivery_status = 'pending_payment'
  and coalesce(amount_paid, 0) >= amount - 0.01;

-- Index for fast lookups of delivery issues
 create index if not exists idx_client_invoices_delivery_status
   on public.client_invoices (org_id, delivery_status)
   where delivery_status in ('delivery_failed', 'payment_received', 'delivering_files');
