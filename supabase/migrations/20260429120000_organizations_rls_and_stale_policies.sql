-- organizations: RLS was on with no policies — authenticated could not read rows; add org-scoped SELECT.
-- deal_notes: legacy "Deal Notes Update Policy" (USING true) was not dropped — 20260425120000 used the wrong
--   policy name ("Deal Notes Update policy" vs "Deal Notes Update Policy").
-- tasks: legacy "Task Update Policy" / "Task Delete Policy" (permissive) were never dropped; org-scoped UPDATE/DELETE were missing.

alter table public.organizations enable row level security;

drop policy if exists "organizations_select_same_org" on public.organizations;

create policy "organizations_select_same_org" on public.organizations
  for select to authenticated
  using (id = public.current_user_org_id());

drop policy if exists "Deal Notes Update Policy" on public.deal_notes;

drop policy if exists "Task Update Policy" on public.tasks;
drop policy if exists "Task Delete Policy" on public.tasks;

drop policy if exists "tasks_update_same_org" on public.tasks;
drop policy if exists "tasks_delete_same_org" on public.tasks;

create policy "tasks_update_same_org" on public.tasks
  for update to authenticated
  using (org_id = public.current_user_org_id())
  with check (org_id = public.current_user_org_id());

create policy "tasks_delete_same_org" on public.tasks
  for delete to authenticated
  using (org_id = public.current_user_org_id());
