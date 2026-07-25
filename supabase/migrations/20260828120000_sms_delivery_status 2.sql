-- Track Twilio SMS delivery lifecycle on outbound conversation messages.

alter table public.conversation_messages
  add column if not exists sms_delivery_status text,
  add column if not exists sms_error_code text;

alter table public.conversation_messages
  drop constraint if exists conversation_messages_sms_delivery_status_check;

alter table public.conversation_messages
  add constraint conversation_messages_sms_delivery_status_check
  check (
    sms_delivery_status is null
    or sms_delivery_status in (
      'queued',
      'sending',
      'sent',
      'delivered',
      'undelivered',
      'failed',
      'canceled'
    )
  );

comment on column public.conversation_messages.sms_delivery_status is
  'Twilio MessageStatus for outbound SMS (updated via status callback).';

comment on column public.conversation_messages.sms_error_code is
  'Twilio ErrorCode when delivery fails (e.g. 30007 carrier filter).';

create index if not exists conversation_messages_external_id_delivery_idx
  on public.conversation_messages (external_id)
  where external_id is not null and direction = 'outbound';
