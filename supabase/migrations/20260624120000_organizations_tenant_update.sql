-- Allow each tenant to update their own organization row (e.g. workspace `name` from the CRM app).
-- Platform operator policy remains; billing columns are not exposed if the client only PATCHes `name`.

drop policy if exists "organizations_update_same_org" on public.organizations;

create policy "organizations_update_same_org" on public.organizations
  for update to authenticated
  using (id = public.current_user_org_id())
  with check (id = public.current_user_org_id());
