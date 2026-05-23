-- Scope deal mutations to visible deals and RBAC capabilities.

drop policy if exists "deals_update_same_org" on public.deals;

create policy "deals_update_scoped" on public.deals
  for update to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('crm.pipeline.edit')
    and public.can_view_deal(id)
  )
  with check (
    org_id = public.current_user_org_id()
    and public.can_view_deal(id)
  );

drop policy if exists "deals_delete_same_org" on public.deals;

create policy "deals_delete_scoped" on public.deals
  for delete to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('crm.pipeline.delete')
    and public.can_view_deal(id)
  );
