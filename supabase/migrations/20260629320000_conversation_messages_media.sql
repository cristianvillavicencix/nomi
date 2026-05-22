-- MMS attachments on SMS messages.
alter table public.conversation_messages
  add column if not exists media_url text;
