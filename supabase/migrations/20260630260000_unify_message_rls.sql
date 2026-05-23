-- Hotfix #1: Unify conversation_messages RLS with conversations scoped visibility.
-- Fixes: permissive user_can_access_conversation bypass + missing type='client' in production.

create or replace function public.can_view_conversation(p_conversation_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select id, administrator, org_id
    from public.organization_members
    where user_id = auth.uid()
    limit 1
  ),
  conv as (
    select c.*
    from public.conversations c
    where c.id = p_conversation_id
  )
  select case
    when not exists (select 1 from me) then false
    when not exists (select 1 from conv) then false
    when (select org_id from conv) <> (select org_id from me) then false
    when (select administrator from me) then true
    when not public.current_member_is_scoped_user() then true
    when (select created_by_member_id from conv) = (select id from me) then true
    when public.is_conversation_participant(
      p_conversation_id,
      (select id from me)
    ) then true
    when exists (
      select 1
      from public.record_shares rs
      where rs.resource_type = 'conversations'
        and rs.resource_id = p_conversation_id
        and rs.member_id = (select id from me)
    ) then true
    when (select type from conv) in ('project', 'client')
      and (select deal_id from conv) is not null
      and public.can_view_deal((select deal_id from conv))
    then true
    else false
  end;
$$;

drop policy if exists "conversation_messages_access" on public.conversation_messages;

drop function if exists public.user_can_access_conversation(bigint);

create function public.user_can_access_conversation(p_conversation_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_view_conversation(p_conversation_id);
$$;

create policy "conversation_messages_access" on public.conversation_messages
  for all to authenticated
  using (public.user_can_access_conversation(conversation_id))
  with check (
    public.user_can_access_conversation(conversation_id)
    and (
      author_member_id is null
      or (
        author_member_id = public.current_user_member_id()
        and public.current_member_has_capability('messaging.send')
      )
    )
  );

grant execute on function public.can_view_conversation(bigint) to authenticated;
grant execute on function public.user_can_access_conversation(bigint) to authenticated;
