-- Denormalize last message direction/author for unread badge logic (skip own outbound).

alter table public.conversations
  add column if not exists last_message_direction text,
  add column if not exists last_message_author_member_id bigint references public.organization_members(id) on delete set null;

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
    last_message_direction = new.direction,
    last_message_author_member_id = new.author_member_id,
    updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

update public.conversations c
set
  last_message_direction = sub.direction,
  last_message_author_member_id = sub.author_member_id
from (
  select distinct on (m.conversation_id)
    m.conversation_id,
    m.direction,
    m.author_member_id
  from public.conversation_messages m
  where m.deleted_at is null
  order by m.conversation_id, m.created_at desc
) sub
where c.id = sub.conversation_id;
