-- Scheduled invoice email delivery (Save and Send Later).

alter table public.client_invoices
  add column if not exists scheduled_send_at timestamptz,
  add column if not exists scheduled_send_message text,
  add column if not exists scheduled_send_storage_path text;

create index if not exists client_invoices_scheduled_send_idx
  on public.client_invoices (scheduled_send_at)
  where scheduled_send_at is not null and status = 'draft';

comment on column public.client_invoices.scheduled_send_at is
  'When the invoice PDF email should be sent automatically.';

comment on column public.client_invoices.scheduled_send_message is
  'Email body stored when scheduling send.';

comment on column public.client_invoices.scheduled_send_storage_path is
  'Storage path for the PDF to attach when the scheduled send runs.';
