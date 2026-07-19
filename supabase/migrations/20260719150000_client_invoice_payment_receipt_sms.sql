-- Allow SMS receipt notification logs alongside email receipt/reminder.

alter table public.client_invoice_email_logs
  drop constraint if exists client_invoice_email_logs_email_type_check;

alter table public.client_invoice_email_logs
  add constraint client_invoice_email_logs_email_type_check
  check (
    email_type in (
      'payment_receipt',
      'payment_reminder',
      'payment_receipt_sms'
    )
  );

comment on column public.client_invoice_email_logs.email_type is
  'payment_receipt | payment_reminder | payment_receipt_sms';
