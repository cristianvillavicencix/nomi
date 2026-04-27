-- Platform console: org soft-disable + platform-operator can update/delete orgs and update members.

-- 1) Soft-disable column on organizations
alter table public.organizations
  add column if not exists disabled_at timestamptz default null;

-- 2) DELETE policy for platform operators (hard delete – use with care)
drop policy if exists "organizations_delete_platform" on public.organizations;

create policy "organizations_delete_platform" on public.organizations
  for delete to authenticated
  using (public.is_platform_operator());

-- 3) Platform operators can update any org_member (e.g. disable a user)
drop policy if exists "organization_members_update_platform" on public.organization_members;

create policy "organization_members_update_platform" on public.organization_members
  for update to authenticated
  using (public.is_platform_operator())
  with check (public.is_platform_operator());
