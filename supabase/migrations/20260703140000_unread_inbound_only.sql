-- Unread badges should reflect customer (inbound) messages only, not teammate replies.

alter table public.tickets
  add column if not exists last_inbound_at timestamptz;

comment on column public.tickets.last_inbound_at is
  'Latest inbound (customer) message time; drives per-member ticket inbox unread state.';

create or replace function public.trg_ticket_message_touch_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tickets
  set
    updated_at = new.created_at,
    last_inbound_at = case
      when new.direction = 'inbound' then new.created_at
      else last_inbound_at
    end
  where id = new.ticket_id;
  return new;
end;
$$;

drop trigger if exists trg_ticket_message_touch_ticket on public.ticket_messages;

create trigger trg_ticket_message_touch_ticket
  after insert on public.ticket_messages
  for each row
  execute function public.trg_ticket_message_touch_ticket();

update public.tickets t
set last_inbound_at = sub.max_inbound
from (
  select ticket_id, max(created_at) as max_inbound
  from public.ticket_messages
  where direction = 'inbound'
  group by ticket_id
) sub
where t.id = sub.ticket_id;

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
    and m.direction = 'inbound'
    and (
      p.last_read_at is null
      or m.created_at > p.last_read_at
    )
  where public.can_view_conversation(c.id)
  group by c.id;
$$;
