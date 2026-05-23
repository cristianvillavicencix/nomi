-- Denormalized preview for inbox list rows (avoids N+1 message fetches).

alter table public.conversations
  add column if not exists last_message_preview text;

create or replace function public.build_conversation_message_preview(
  body text,
  media_url text,
  is_internal_note boolean
)
returns text
language sql
immutable
as $$
  select case
    when coalesce(is_internal_note, false) then
      coalesce(nullif(left(trim(body), 120), ''), 'Internal note')
    when media_url is not null and coalesce(trim(body), '') = '' then 'Sent an attachment'
    else coalesce(nullif(left(trim(body), 200), ''), 'New message')
  end;
$$;

create or replace function public.trg_conversation_message_touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set
    last_message_at = new.created_at,
    last_message_preview = public.build_conversation_message_preview(
      new.body,
      new.media_url,
      new.is_internal_note
    ),
    updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

update public.conversations c
set last_message_preview = sub.preview
from (
  select distinct on (m.conversation_id)
    m.conversation_id,
    public.build_conversation_message_preview(m.body, m.media_url, m.is_internal_note) as preview
  from public.conversation_messages m
  order by m.conversation_id, m.created_at desc
) sub
where c.id = sub.conversation_id;
