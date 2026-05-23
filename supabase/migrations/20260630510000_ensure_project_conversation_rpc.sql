-- Reliable project team chat bootstrap (bypasses INSERT RLS edge cases).

create or replace function public.ensure_project_conversation(
  p_deal_id bigint,
  p_title text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id bigint;
  v_conv_id bigint;
  v_title text;
begin
  v_member_id := public.current_user_member_id();
  if v_member_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.can_view_deal(p_deal_id) then
    raise exception 'No access to this project';
  end if;

  if not public.current_member_has_capability('messaging.send') then
    raise exception 'Missing messaging permission';
  end if;

  select c.id
  into v_conv_id
  from public.conversations c
  where c.deal_id = p_deal_id
    and c.type = 'project'
  limit 1;

  if v_conv_id is not null then
    insert into public.conversation_participants (
      conversation_id,
      member_id,
      last_read_at
    )
    values (v_conv_id, v_member_id, now())
    on conflict (conversation_id, member_id) do nothing;

    return v_conv_id;
  end if;

  v_title := coalesce(nullif(btrim(p_title), ''), 'Project team chat');

  insert into public.conversations (
    type,
    deal_id,
    title,
    created_by_member_id
  )
  values ('project', p_deal_id, v_title, v_member_id)
  returning id into v_conv_id;

  insert into public.conversation_participants (
    conversation_id,
    member_id,
    last_read_at
  )
  values (v_conv_id, v_member_id, now())
  on conflict (conversation_id, member_id) do nothing;

  return v_conv_id;
end;
$$;

revoke all on function public.ensure_project_conversation(bigint, text) from public;
grant execute on function public.ensure_project_conversation(bigint, text) to authenticated;

drop policy if exists "conversations_access" on public.conversations;
create policy "conversations_access" on public.conversations
  for all to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.can_view_conversation(id)
  )
  with check (
    org_id = public.current_user_org_id()
    and (
      created_by_member_id = public.current_user_member_id()
      or (
        type in ('project', 'client')
        and deal_id is not null
        and public.can_view_deal(deal_id)
      )
      or public.can_view_conversation(id)
    )
  );
