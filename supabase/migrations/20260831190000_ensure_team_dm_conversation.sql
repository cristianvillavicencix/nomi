-- Reliable 1:1 team DM bootstrap for scoped (standard) users.
-- Direct INSERT into conversations fails when PostgREST RETURNING re-checks RLS
-- before participants exist (see 20260710140000_fix_conversations_returning_rls.sql).

create or replace function public.ensure_team_dm_conversation(
  p_other_member_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id bigint;
  v_conv_id bigint;
  v_dm_key text;
  v_title text;
  v_other_org_id bigint;
begin
  v_member_id := public.current_user_member_id();
  if v_member_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_other_member_id is null or p_other_member_id = v_member_id then
    raise exception 'Invalid recipient';
  end if;

  if not public.current_member_has_capability('messaging.send') then
    raise exception 'Missing messaging permission';
  end if;

  select m.org_id
  into v_other_org_id
  from public.organization_members m
  where m.id = p_other_member_id
    and coalesce(m.disabled, false) = false;

  if v_other_org_id is null
    or v_other_org_id is distinct from public.current_user_org_id() then
    raise exception 'Recipient not in your organization';
  end if;

  v_dm_key :=
    least(v_member_id::text, p_other_member_id::text)
    || ':'
    || greatest(v_member_id::text, p_other_member_id::text);

  select c.id
  into v_conv_id
  from public.conversations c
  where c.org_id = public.current_user_org_id()
    and c.type = 'team_dm'
    and c.dm_key = v_dm_key
  limit 1;

  if v_conv_id is not null then
    insert into public.conversation_participants (conversation_id, member_id)
    values
      (v_conv_id, v_member_id),
      (v_conv_id, p_other_member_id)
    on conflict (conversation_id, member_id) do nothing;

    return v_conv_id;
  end if;

  select coalesce(
    nullif(btrim(coalesce(m.first_name, '') || ' ' || coalesce(m.last_name, '')), ''),
    'Direct message'
  )
  into v_title
  from public.organization_members m
  where m.id = p_other_member_id;

  insert into public.conversations (
    type,
    title,
    dm_key,
    created_by_member_id
  )
  values ('team_dm', v_title, v_dm_key, v_member_id)
  returning id into v_conv_id;

  insert into public.conversation_participants (conversation_id, member_id)
  values
    (v_conv_id, v_member_id),
    (v_conv_id, p_other_member_id)
  on conflict (conversation_id, member_id) do nothing;

  return v_conv_id;
end;
$$;

revoke all on function public.ensure_team_dm_conversation(bigint) from public;
grant execute on function public.ensure_team_dm_conversation(bigint) to authenticated, service_role;

-- Keep INSERT policies aligned with RETURNING behavior for any direct client creates.
drop policy if exists "conversations_access" on public.conversations;
create policy "conversations_access" on public.conversations
  for all to authenticated
  using (
    org_id = public.current_user_org_id()
    and (
      created_by_member_id = public.current_user_member_id()
      or assignee_member_id = public.current_user_member_id()
      or (
        type in ('project', 'client')
        and deal_id is not null
        and public.can_view_deal(deal_id)
      )
      or (
        type = 'team_dm'
        and public.is_conversation_participant(
          id,
          public.current_user_member_id()
        )
      )
      or public.can_view_conversation(id)
    )
  )
  with check (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('messaging.send')
    and (
      created_by_member_id = public.current_user_member_id()
      or (
        type in ('project', 'client')
        and deal_id is not null
        and public.can_view_deal(deal_id)
      )
      or (
        type = 'team_dm'
        and created_by_member_id = public.current_user_member_id()
      )
      or public.can_view_conversation(id)
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
        and public.can_view_conversation(c.id)
    )
  )
  with check (
    member_id = public.current_user_member_id()
    or exists (
      select 1
      from public.conversations c
      where c.id = conversation_participants.conversation_id
        and c.org_id = public.current_user_org_id()
        and (
          c.created_by_member_id = public.current_user_member_id()
          or public.can_view_conversation(c.id)
        )
    )
  );
