-- Track payment receipt/reminder delivery outcomes (sent, failed, skipped).

alter table public.client_invoice_email_logs
  add column if not exists delivery_status text not null default 'sent'
    check (delivery_status in ('sent', 'failed', 'skipped')),
  add column if not exists error_message text;

comment on column public.client_invoice_email_logs.delivery_status is
  'sent = delivered, failed = send error, skipped = intentionally not sent (duplicate, no email, etc.)';
