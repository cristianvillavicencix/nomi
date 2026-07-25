-- Inline email images (Content-ID / cid: references) for mail reader resolution.
alter table public.mail_attachments
  add column if not exists content_id text;

create index if not exists mail_attachments_message_content_id_idx
  on public.mail_attachments (message_id, content_id)
  where content_id is not null;
