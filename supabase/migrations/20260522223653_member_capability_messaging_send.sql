-- Enforce granular messaging.send on outbound conversation_messages inserts.

create or replace function public.current_member_has_capability(p_capability text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  member_row public.organization_members%rowtype;
  perms jsonb;
  mod_key text;
  has_granular boolean;
begin
  select * into member_row
  from public.organization_members
  where user_id = auth.uid()
  limit 1;

  if member_row.id is null then
    return false;
  end if;

  if member_row.administrator then
    return true;
  end if;

  if member_row.module_permissions is null then
    return true;
  end if;

  perms := member_row.module_permissions;
  mod_key := split_part(p_capability, '.', 1);

  if not (
    coalesce((perms ->> mod_key)::boolean, false)
    or exists (
      select 1
      from jsonb_each(perms) entry
      where entry.key like mod_key || '.%'
        and coalesce(entry.value::text::boolean, false)
    )
  ) then
    return false;
  end if;

  if perms ? p_capability then
    return coalesce((perms ->> p_capability)::boolean, false);
  end if;

  select exists (
    select 1
    from jsonb_each(perms) entry
    where entry.key like mod_key || '.%'
  ) into has_granular;

  if has_granular then
    return false;
  end if;

  return coalesce((perms ->> mod_key)::boolean, false);
end;
$$;

grant execute on function public.current_member_has_capability(text) to authenticated;

drop policy if exists "conversation_messages_access" on public.conversation_messages;
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
