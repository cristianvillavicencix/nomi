-- Allow commercial settings users with proposals.edit to manage contract terms templates.

drop policy if exists "organization_contract_terms_org_scoped"
  on public.organization_contract_terms;

create policy "organization_contract_terms_org_scoped"
  on public.organization_contract_terms for all to authenticated
  using (org_id = public.current_user_org_id())
  with check (
    org_id = public.current_user_org_id()
    and (
      public.current_member_has_capability('contracts.edit')
      or public.current_member_has_capability('proposals.edit')
    )
  );
