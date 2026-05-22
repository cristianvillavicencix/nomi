-- Unified RBAC: record_shares, scoped visibility helpers, capability checks.

create table if not exists public.record_shares (
  id bigint generated always as identity primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  resource_type text not null check (
    resource_type in ('deals', 'proposals', 'contracts', 'tasks', 'conversations', 'tickets')
  ),
  resource_id bigint not null,
  member_id bigint not null references public.organization_members (id) on delete cascade,
  shared_by_member_id bigint not null references public.organization_members (id),
  created_at timestamptz not null default now(),
  unique (org_id, resource_type, resource_id, member_id)
);

create index if not exists idx_record_shares_lookup
  on public.record_shares (member_id, resource_type, resource_id);

alter table public.record_shares enable row level security;

grant select, insert, delete on public.record_shares to authenticated;
grant all on public.record_shares to service_role;

create or replace function public.current_user_person_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.organization_members om
  join public.people p
    on p.org_id = om.org_id
   and lower(trim(coalesce(p.email, ''))) = lower(trim(coalesce(om.email, '')))
  where om.user_id = auth.uid()
  limit 1;
$$;

grant execute on function public.current_user_person_id() to authenticated;

create or replace function public.current_member_is_scoped_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select
        not om.administrator
        and coalesce(om.module_permissions ->> '_role_preset', '') = 'user'
      from public.organization_members om
      where om.user_id = auth.uid()
      limit 1
    ),
    false
  );
$$;

grant execute on function public.current_member_is_scoped_user() to authenticated;

create or replace function public.infer_member_role_preset_from_legacy(
  p_administrator boolean,
  p_roles text[]
)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_administrator then 'super_admin'
    when p_roles && array['admin', 'sales_manager', 'manager']::text[] then 'admin'
    when p_roles && array['employee', 'designer', 'developer', 'marketing', 'sales', 'pm']::text[]
      then 'user'
    else 'read_only'
  end;
$$;

create or replace function public.member_has_capability_from_preset(
  p_preset text,
  p_capability text
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case p_preset
    when 'super_admin' then true
    when 'admin' then p_capability <> 'admin.settings.manage'
    when 'user' then p_capability not like 'deal_financials.%'
      and p_capability <> 'view_amounts.show'
      and p_capability not in (
        'admin.settings.manage',
        'admin.users.manage',
        'forms.manage',
        'contracts.create',
        'contracts.edit',
        'contracts.delete',
        'proposals.send',
        'proposals.delete',
        'messaging.settings.manage',
        'deal_operations.subcontractors.manage',
        'deal_operations.credentials.manage',
        'reports.view'
      )
    when 'read_only' then p_capability like '%.view'
      or p_capability in ('calendar.view', 'meetings.view', 'forms.submissions.view')
    else false
  end;
$$;

grant execute on function public.infer_member_role_preset_from_legacy(boolean, text[]) to authenticated;
grant execute on function public.member_has_capability_from_preset(text, text) to authenticated;

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
  preset text;
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

  perms := coalesce(member_row.module_permissions, '{}'::jsonb);

  if perms ? p_capability then
    return coalesce((perms ->> p_capability)::boolean, false);
  end if;

  preset := coalesce(
    nullif(perms ->> '_role_preset', ''),
    public.infer_member_role_preset_from_legacy(
      member_row.administrator,
      coalesce(member_row.roles, array[]::text[])
    )
  );

  return public.member_has_capability_from_preset(preset, p_capability);
end;
$$;

create or replace function public.can_view_deal(p_deal_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select id, administrator, org_id
    from public.organization_members
    where user_id = auth.uid()
    limit 1
  )
  select case
    when not exists (select 1 from me) then false
    when (select administrator from me) then true
    when not public.current_member_is_scoped_user() then true
    else exists (
      select 1
      from public.deals d
      cross join me
      where d.id = p_deal_id
        and d.org_id = me.org_id
        and (
          d.organization_member_id = me.id
          or public.current_user_person_id() = any (d.salesperson_ids)
          or public.current_user_person_id() = any (d.worker_ids)
          or public.current_user_person_id() = any (d.subcontractor_ids)
          or exists (
            select 1
            from public.record_shares rs
            where rs.resource_type = 'deals'
              and rs.resource_id = d.id
              and rs.member_id = me.id
          )
        )
    )
  end;
$$;

create or replace function public.can_view_proposal(p_proposal_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select id, administrator, org_id
    from public.organization_members
    where user_id = auth.uid()
    limit 1
  )
  select case
    when not exists (select 1 from me) then false
    when (select administrator from me) then true
    when not public.current_member_is_scoped_user() then true
    else exists (
      select 1
      from public.proposals p
      cross join me
      where p.id = p_proposal_id
        and p.org_id = me.org_id
        and (
          p.organization_member_id = me.id
          or (p.deal_id is not null and public.can_view_deal(p.deal_id))
          or exists (
            select 1
            from public.record_shares rs
            where rs.resource_type = 'proposals'
              and rs.resource_id = p.id
              and rs.member_id = me.id
          )
        )
    )
  end;
$$;

create or replace function public.can_view_contract(p_contract_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select id, administrator, org_id
    from public.organization_members
    where user_id = auth.uid()
    limit 1
  )
  select case
    when not exists (select 1 from me) then false
    when (select administrator from me) then true
    when not public.current_member_is_scoped_user() then true
    else exists (
      select 1
      from public.contracts c
      cross join me
      where c.id = p_contract_id
        and c.org_id = me.org_id
        and (
          c.organization_member_id = me.id
          or (c.deal_id is not null and public.can_view_deal(c.deal_id))
          or exists (
            select 1
            from public.record_shares rs
            where rs.resource_type = 'contracts'
              and rs.resource_id = c.id
              and rs.member_id = me.id
          )
        )
    )
  end;
$$;

create or replace function public.can_view_task(p_task_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select id, administrator, org_id
    from public.organization_members
    where user_id = auth.uid()
    limit 1
  )
  select case
    when not exists (select 1 from me) then false
    when (select administrator from me) then true
    when not public.current_member_is_scoped_user() then true
    else exists (
      select 1
      from public.tasks t
      cross join me
      where t.id = p_task_id
        and t.org_id = me.org_id
        and (
          t.organization_member_id = me.id
          or public.current_user_person_id() = any (t.assignee_person_ids)
          or public.current_user_person_id() = any (t.collaborator_person_ids)
          or me.id = any (t.mentioned_member_ids)
          or exists (
            select 1
            from public.record_shares rs
            where rs.resource_type = 'tasks'
              and rs.resource_id = t.id
              and rs.member_id = me.id
          )
        )
    )
  end;
$$;

create or replace function public.can_view_conversation(p_conversation_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select id, administrator, org_id
    from public.organization_members
    where user_id = auth.uid()
    limit 1
  )
  select case
    when not exists (select 1 from me) then false
    when (select administrator from me) then true
    when not public.current_member_is_scoped_user() then true
    else exists (
      select 1
      from public.conversations c
      cross join me
      where c.id = p_conversation_id
        and c.org_id = me.org_id
        and (
          public.is_conversation_participant(c.id, me.id)
          or exists (
            select 1
            from public.record_shares rs
            where rs.resource_type = 'conversations'
              and rs.resource_id = c.id
              and rs.member_id = me.id
          )
        )
    )
  end;
$$;

create or replace function public.can_view_ticket(p_ticket_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select id, administrator, org_id
    from public.organization_members
    where user_id = auth.uid()
    limit 1
  )
  select case
    when not exists (select 1 from me) then false
    when (select administrator from me) then true
    when not public.current_member_is_scoped_user() then true
    else exists (
      select 1
      from public.tickets t
      cross join me
      where t.id = p_ticket_id
        and t.org_id = me.org_id
        and (
          t.organization_member_id = me.id
          or t.assignee_id = me.id
          or exists (
            select 1
            from public.record_shares rs
            where rs.resource_type = 'tickets'
              and rs.resource_id = t.id
              and rs.member_id = me.id
          )
        )
    )
  end;
$$;

grant execute on function public.can_view_deal(bigint) to authenticated;
grant execute on function public.can_view_proposal(bigint) to authenticated;
grant execute on function public.can_view_contract(bigint) to authenticated;
grant execute on function public.can_view_task(bigint) to authenticated;
grant execute on function public.can_view_conversation(bigint) to authenticated;
grant execute on function public.can_view_ticket(bigint) to authenticated;

create index if not exists idx_deals_salesperson_ids on public.deals using gin (salesperson_ids);
create index if not exists idx_deals_worker_ids on public.deals using gin (worker_ids);
create index if not exists idx_deals_subcontractor_ids on public.deals using gin (subcontractor_ids);
create index if not exists idx_tasks_collaborator_person_ids on public.tasks using gin (collaborator_person_ids);

drop policy if exists "record_shares_insert_admin" on public.record_shares;
create policy "record_shares_insert_admin" on public.record_shares
  for insert
  with check (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('admin.users.manage')
  );

drop policy if exists "record_shares_select_own_or_admin" on public.record_shares;
create policy "record_shares_select_own_or_admin" on public.record_shares
  for select
  using (
    org_id = public.current_user_org_id()
    and (
      member_id = public.current_user_member_id()
      or public.current_member_has_capability('admin.users.manage')
    )
  );

drop policy if exists "record_shares_delete_admin" on public.record_shares;
create policy "record_shares_delete_admin" on public.record_shares
  for delete
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('admin.users.manage')
  );

drop policy if exists "deals_select_same_org" on public.deals;
drop policy if exists "deals_select_scoped" on public.deals;
create policy "deals_select_scoped" on public.deals
  for select
  to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('crm.pipeline.view')
    and public.can_view_deal(id)
  );

drop policy if exists "Proposals org scoped" on public.proposals;
create policy "proposals_select_scoped" on public.proposals
  for select
  to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('proposals.view')
    and public.can_view_proposal(id)
  );

drop policy if exists "proposals_mutate_scoped" on public.proposals;
create policy "proposals_write_scoped" on public.proposals
  for insert
  to authenticated
  with check (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('proposals.create')
  );

create policy "proposals_update_scoped" on public.proposals
  for update
  to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('proposals.edit')
    and public.can_view_proposal(id)
  )
  with check (org_id = public.current_user_org_id());

create policy "proposals_delete_scoped" on public.proposals
  for delete
  to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('proposals.delete')
    and public.can_view_proposal(id)
  );

drop policy if exists "Contracts org scoped" on public.contracts;
create policy "contracts_select_scoped" on public.contracts
  for select
  to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('contracts.view')
    and public.can_view_contract(id)
  );

drop policy if exists "contracts_mutate_scoped" on public.contracts;
create policy "contracts_write_scoped" on public.contracts
  for insert
  to authenticated
  with check (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('contracts.create')
  );

create policy "contracts_update_scoped" on public.contracts
  for update
  to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('contracts.edit')
    and public.can_view_contract(id)
  )
  with check (org_id = public.current_user_org_id());

create policy "contracts_delete_scoped" on public.contracts
  for delete
  to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('contracts.delete')
    and public.can_view_contract(id)
  );

drop policy if exists "Tickets org scoped" on public.tickets;
create policy "tickets_select_scoped" on public.tickets
  for select
  to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('support.tickets.view')
    and public.can_view_ticket(id)
  );

drop policy if exists "tickets_mutate_scoped" on public.tickets;
create policy "tickets_write_scoped" on public.tickets
  for insert
  to authenticated
  with check (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('support.tickets.manage')
  );

create policy "tickets_update_scoped" on public.tickets
  for update
  to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('support.tickets.manage')
    and public.can_view_ticket(id)
  )
  with check (org_id = public.current_user_org_id());

create policy "tickets_delete_scoped" on public.tickets
  for delete
  to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('support.tickets.manage')
    and public.can_view_ticket(id)
  );
