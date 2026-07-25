alter table public.client_invoices
  add column if not exists scheduled_send_sms_to text,
  add column if not exists scheduled_send_sms_body text;

comment on column public.client_invoices.scheduled_send_sms_to is
  'Optional mobile number for scheduled invoice SMS delivery.';

comment on column public.client_invoices.scheduled_send_sms_body is
  'Optional SMS body stored when scheduling invoice delivery.';
