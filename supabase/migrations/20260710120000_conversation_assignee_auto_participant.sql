-- When a conversation is (re)assigned to a member, automatically add them as
-- a participant. Without this row, the assignee cannot see the conversation
-- in their inbox: useInboxConversations only lists conversations they
-- participate in, and the RLS visibility helper `can_view_conversation`
-- relies on the same participant link for client/team_dm conversations
-- they did not create.

create or replace function public.ensure_assignee_is_participant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.assignee_member_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and new.assignee_member_id is not distinct from old.assignee_member_id then
    return new;
  end if;

  insert into public.conversation_participants (
    conversation_id,
    member_id
  )
  values (
    new.id,
    new.assignee_member_id
  )
  on conflict (conversation_id, member_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_conversation_assignee_participant
  on public.conversations;

create trigger trg_conversation_assignee_participant
  after insert or update of assignee_member_id on public.conversations
  for each row
  execute function public.ensure_assignee_is_participant();

-- Backfill: ensure every conversation currently assigned to someone has a
-- corresponding participant row. Safe to re-run thanks to the unique
-- (conversation_id, member_id) constraint.
insert into public.conversation_participants (conversation_id, member_id)
select c.id, c.assignee_member_id
from public.conversations c
where c.assignee_member_id is not null
on conflict (conversation_id, member_id) do nothing;

-- Publish conversation_participants to realtime so an assignee's other
-- browser/device picks up the new row without waiting for the 15s
-- staleTime on the participations query.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'conversation_participants'
  ) then
    alter publication supabase_realtime add table public.conversation_participants;
  end if;
end $$;

alter table public.conversation_participants replica identity full;
