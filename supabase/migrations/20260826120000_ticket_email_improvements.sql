-- Ticket email improvements: Cc storage, dedup, configurable inbox signature.

alter table public.ticket_messages
  add column if not exists cc_emails text[] not null default '{}';

comment on column public.ticket_messages.cc_emails is
  'Cc recipients for this message (inbound or outbound).';

create unique index if not exists ticket_messages_external_message_id_unique_idx
  on public.ticket_messages (external_message_id)
  where external_message_id is not null and btrim(external_message_id) <> '';

alter table public.ticket_inboxes
  add column if not exists reply_signature_html text,
  add column if not exists reply_signature_text text;

comment on column public.ticket_inboxes.reply_signature_html is
  'Optional HTML signature appended to outbound ticket replies from this inbox.';
comment on column public.ticket_inboxes.reply_signature_text is
  'Optional plain-text signature for outbound ticket replies from this inbox.';
