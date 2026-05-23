-- Scope deal notes to deals the member can view.

drop policy if exists "deal_notes_select_same_org" on public.deal_notes;
drop policy if exists "deal_notes_insert_same_org" on public.deal_notes;
drop policy if exists "deal_notes_update_same_org" on public.deal_notes;
drop policy if exists "deal_notes_delete_same_org" on public.deal_notes;

create policy "deal_notes_select_scoped" on public.deal_notes
  for select to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.can_view_deal(deal_id)
  );

create policy "deal_notes_insert_scoped" on public.deal_notes
  for insert to authenticated
  with check (
    org_id = public.current_user_org_id()
    and public.can_view_deal(deal_id)
  );

create policy "deal_notes_update_scoped" on public.deal_notes
  for update to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.can_view_deal(deal_id)
  )
  with check (
    org_id = public.current_user_org_id()
    and public.can_view_deal(deal_id)
  );

create policy "deal_notes_delete_scoped" on public.deal_notes
  for delete to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.can_view_deal(deal_id)
  );
