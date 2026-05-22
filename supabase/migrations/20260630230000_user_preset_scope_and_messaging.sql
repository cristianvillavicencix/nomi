-- User preset: project-scoped workspace access + messaging tied to assigned deals.
-- Org-level custom role preset labels/templates (JSON on organizations).

alter table public.organizations
  add column if not exists rbac_config jsonb not null default '{}'::jsonb;

comment on column public.organizations.rbac_config is
  'Workspace RBAC: presetLabels, customPresets templates for Settings → Users.';

-- Flag scoped members (user preset and scoped custom presets).
update public.organization_members om
set module_permissions = coalesce(om.module_permissions, '{}'::jsonb)
  || jsonb_build_object('_scoped_to_projects', true)
where not om.administrator
  and coalesce(om.module_permissions ->> '_role_preset', '') = 'user'
  and coalesce(om.module_permissions ->> '_scoped_to_projects', '') <> 'true';

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
        and (
          coalesce(om.module_permissions ->> '_scoped_to_projects', '') = 'true'
          or coalesce(om.module_permissions ->> '_role_preset', '') = 'user'
        )
      from public.organization_members om
      where om.user_id = auth.uid()
      limit 1
    ),
    false
  );
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
        'crm.contacts.view',
        'crm.contacts.create',
        'crm.contacts.edit',
        'crm.contacts.delete',
        'crm.companies.view',
        'crm.companies.create',
        'crm.companies.edit',
        'crm.companies.delete',
        'proposals.view',
        'proposals.create',
        'proposals.edit',
        'proposals.send',
        'proposals.delete',
        'contracts.view',
        'contracts.create',
        'contracts.edit',
        'contracts.delete',
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
          or (
            c.type in ('project', 'client')
            and c.deal_id is not null
            and public.can_view_deal(c.deal_id)
          )
        )
    )
  end;
$$;

drop policy if exists "conversations_access" on public.conversations;
create policy "conversations_access" on public.conversations
  for all to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.can_view_conversation(id)
  )
  with check (
    org_id = public.current_user_org_id()
    and (
      public.can_view_conversation(id)
      or created_by_member_id = public.current_user_member_id()
    )
  );

drop policy if exists "conversation_participants_access" on public.conversation_participants;
create policy "conversation_participants_access" on public.conversation_participants
  for all to authenticated
  using (
    member_id = public.current_user_member_id()
    or exists (
      select 1
      from public.conversations c
      where c.id = conversation_participants.conversation_id
        and c.org_id = public.current_user_org_id()
        and public.can_view_conversation(c.id)
    )
  )
  with check (
    member_id = public.current_user_member_id()
    or exists (
      select 1
      from public.conversations c
      where c.id = conversation_participants.conversation_id
        and c.org_id = public.current_user_org_id()
        and public.can_view_conversation(c.id)
    )
  );
