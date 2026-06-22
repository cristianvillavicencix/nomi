-- Store all MMS attachments on a single message (Twilio can send multiple images per SMS).

alter table public.conversation_messages
  add column if not exists media_urls text[] not null default '{}';

comment on column public.conversation_messages.media_urls is
  'All attachment storage paths or legacy public URLs for this message.';

update public.conversation_messages
set media_urls = array[media_url]
where media_url is not null
  and media_urls = '{}';
