-- Track outbound ticket email delivery on ticket_messages.

alter table public.ticket_messages
  add column if not exists email_delivery_status text,
  add column if not exists email_error_code text;

alter table public.ticket_messages
  drop constraint if exists ticket_messages_email_delivery_status_check;

alter table public.ticket_messages
  add constraint ticket_messages_email_delivery_status_check
  check (
    email_delivery_status is null
    or email_delivery_status in (
      'queued',
      'sent',
      'delivered',
      'undelivered',
      'failed',
      'skipped'
    )
  );

comment on column public.ticket_messages.email_delivery_status is
  'Outbound email lifecycle for ticket replies (sent, skipped, failed, etc.).';

comment on column public.ticket_messages.email_error_code is
  'Provider error code when outbound ticket email delivery fails.';
