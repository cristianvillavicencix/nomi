-- Fix infinite RLS recursion between conversations and conversation_participants.

create or replace function public.is_conversation_participant(
  conv_id bigint,
  member_id bigint
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = conv_id
      and cp.member_id = member_id
  );
$$;

grant execute on function public.is_conversation_participant(bigint, bigint) to authenticated;

create or replace function public.user_can_access_conversation(conv_id bigint)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  allowed boolean;
begin
  perform set_config('row_security', 'off', true);

  select exists (
    select 1
    from public.conversations c
    where c.id = conv_id
      and c.org_id = public.current_user_org_id()
      and (
        c.type = 'project'
        or c.created_by_member_id = public.current_user_member_id()
        or public.is_conversation_participant(c.id, public.current_user_member_id())
      )
  )
  into allowed;

  return coalesce(allowed, false);
end;
$$;

grant execute on function public.user_can_access_conversation(bigint) to authenticated;

drop policy if exists "conversations_access" on public.conversations;
create policy "conversations_access" on public.conversations
  for all to authenticated
  using (
    org_id = public.current_user_org_id()
    and (
      type = 'project'
      or created_by_member_id = public.current_user_member_id()
      or public.is_conversation_participant(id, public.current_user_member_id())
    )
  )
  with check (
    org_id = public.current_user_org_id()
    and (
      type = 'project'
      or created_by_member_id = public.current_user_member_id()
      or public.is_conversation_participant(id, public.current_user_member_id())
    )
  );

drop policy if exists "conversation_participants_access" on public.conversation_participants;
create policy "conversation_participants_access" on public.conversation_participants
  for all to authenticated
  using (
    member_id = public.current_user_member_id()
    or exists (
      select 1
      from public.conversations c
      where c.id = conversation_participants.conversation_id
        and c.org_id = public.current_user_org_id()
        and (
          c.type = 'project'
          or c.created_by_member_id = public.current_user_member_id()
        )
    )
  )
  with check (
    member_id = public.current_user_member_id()
    or exists (
      select 1
      from public.conversations c
      where c.id = conversation_participants.conversation_id
        and c.org_id = public.current_user_org_id()
        and c.created_by_member_id = public.current_user_member_id()
    )
  );

drop policy if exists "conversation_messages_access" on public.conversation_messages;
create policy "conversation_messages_access" on public.conversation_messages
  for all to authenticated
  using (public.user_can_access_conversation(conversation_id))
  with check (
    public.user_can_access_conversation(conversation_id)
    and (
      author_member_id is null
      or author_member_id = public.current_user_member_id()
    )
  );
