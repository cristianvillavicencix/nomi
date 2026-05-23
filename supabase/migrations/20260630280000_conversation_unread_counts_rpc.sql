-- Batch unread message counts per conversation for the current member.

create index if not exists idx_conversations_unread_lookup
  on public.conversations (org_id, last_message_at)
  where last_message_direction = 'inbound';

create or replace function public.get_unread_counts_for_conversations(
  p_conversation_ids bigint[]
)
returns table(conversation_id bigint, unread_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select public.current_user_member_id() as id
  ),
  participations as (
    select cp.conversation_id, cp.last_read_at
    from public.conversation_participants cp
    cross join me
    where cp.member_id = me.id
      and cp.conversation_id = any (p_conversation_ids)
  )
  select
    c.id as conversation_id,
    count(m.id)::bigint as unread_count
  from unnest(p_conversation_ids) as cid(id)
  join public.conversations c on c.id = cid.id
  left join participations p on p.conversation_id = c.id
  left join public.conversation_messages m on
    m.conversation_id = c.id
    and m.deleted_at is null
    and (
      m.author_member_id is null
      or m.author_member_id <> (select id from me)
    )
    and (
      p.last_read_at is null
      or m.created_at > p.last_read_at
    )
  where public.can_view_conversation(c.id)
  group by c.id;
$$;

grant execute on function public.get_unread_counts_for_conversations(bigint[]) to authenticated;
