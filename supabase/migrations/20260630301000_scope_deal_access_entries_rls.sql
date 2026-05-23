-- Scope credential access by deal visibility and RBAC capabilities.

drop policy if exists "Deal access entries org scoped" on public.deal_access_entries;

create policy "deal_access_entries_select_scoped" on public.deal_access_entries
  for select to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('deal_operations.credentials.view')
    and public.can_view_deal(deal_id)
  );

create policy "deal_access_entries_insert_scoped" on public.deal_access_entries
  for insert to authenticated
  with check (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('deal_operations.credentials.manage')
    and public.can_view_deal(deal_id)
  );

create policy "deal_access_entries_update_scoped" on public.deal_access_entries
  for update to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('deal_operations.credentials.manage')
    and public.can_view_deal(deal_id)
  )
  with check (
    org_id = public.current_user_org_id()
    and public.can_view_deal(deal_id)
  );

create policy "deal_access_entries_delete_scoped" on public.deal_access_entries
  for delete to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('deal_operations.credentials.manage')
    and public.can_view_deal(deal_id)
  );
