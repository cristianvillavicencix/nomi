-- Multi-tenant DELETE was missing: old init policies may be absent in some DBs, leaving no DELETE
-- policy for authenticated (RLS default deny = deletes appear to "do nothing").

drop policy if exists "Contact Delete Policy" on public.contacts;
drop policy if exists "contacts_delete_same_org" on public.contacts;

create policy "contacts_delete_same_org" on public.contacts
  for delete to authenticated
  using (org_id = public.current_user_org_id());

drop policy if exists "Deals Delete Policy" on public.deals;
drop policy if exists "deals_delete_same_org" on public.deals;

create policy "deals_delete_same_org" on public.deals
  for delete to authenticated
  using (org_id = public.current_user_org_id());
