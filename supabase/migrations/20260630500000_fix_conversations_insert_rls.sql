-- Fix project team chat creation: auto-set creator and allow INSERT when user can view the deal.

create or replace function public.trg_conversations_set_creator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by_member_id is null then
    new.created_by_member_id := public.current_user_member_id();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_conversations_set_creator on public.conversations;
create trigger trg_conversations_set_creator
  before insert on public.conversations
  for each row execute function public.trg_conversations_set_creator();

drop policy if exists "conversations_access" on public.conversations;
create policy "conversations_access" on public.conversations
  for all to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.can_view_conversation(id)
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
      or public.can_view_conversation(id)
    )
  );
