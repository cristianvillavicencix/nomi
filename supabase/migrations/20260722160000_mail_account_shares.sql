-- Per-mailbox sharing for organization CRM mail accounts.

create table if not exists public.mail_account_shares (
  id bigint generated always as identity primary key,
  account_id bigint not null references public.mail_accounts (id) on delete cascade,
  member_id bigint not null references public.organization_members (id) on delete cascade,
  can_view boolean not null default true,
  can_send boolean not null default false,
  granted_by_member_id bigint references public.organization_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mail_account_shares_account_member_uidx unique (account_id, member_id),
  constraint mail_account_shares_view_or_send check (can_view or can_send)
);

create index if not exists mail_account_shares_member_idx
  on public.mail_account_shares (member_id);

create index if not exists mail_account_shares_account_idx
  on public.mail_account_shares (account_id);

comment on table public.mail_account_shares is
  'Grants specific members access to an organization mailbox (view/send).';

create or replace function public.mail_account_is_org_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_member_has_capability('mail.org.manage')
    or public.current_member_has_capability('mail.org.share');
$$;

create or replace function public.mail_account_has_share(
  p_account_id bigint,
  p_need_send boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.mail_account_shares s
    where s.account_id = p_account_id
      and s.member_id = public.current_user_member_id()
      and (
        (not p_need_send and s.can_view)
        or (p_need_send and s.can_send)
      )
  );
$$;

create or replace function public.mail_account_is_readable(p_account public.mail_accounts)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_account.org_id = public.current_user_org_id()
    and (
      (
        p_account.owner_member_id is null
        and (
          public.mail_account_is_org_admin()
          or public.mail_account_has_share(p_account.id, false)
        )
      )
      or (
        p_account.owner_member_id = public.current_user_member_id()
        and public.current_member_has_capability('mail.personal.view')
      )
    );
$$;

create or replace function public.mail_account_can_send(p_account public.mail_accounts)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_account.org_id = public.current_user_org_id()
    and (
      (
        p_account.owner_member_id is null
        and (
          public.current_member_has_capability('mail.org.manage')
          or (
            public.mail_account_has_share(p_account.id, true)
            and public.current_member_has_capability('mail.org.send')
          )
        )
      )
      or (
        p_account.owner_member_id = public.current_user_member_id()
        and public.current_member_has_capability('mail.personal.send')
      )
    );
$$;

alter table public.mail_account_shares enable row level security;

grant select, insert, update, delete on public.mail_account_shares to authenticated;

create policy mail_account_shares_select on public.mail_account_shares
  for select to authenticated
  using (
    exists (
      select 1
      from public.mail_accounts a
      where a.id = mail_account_shares.account_id
        and a.org_id = public.current_user_org_id()
        and (
          public.mail_account_is_org_admin()
          or mail_account_shares.member_id = public.current_user_member_id()
        )
    )
  );

create policy mail_account_shares_insert on public.mail_account_shares
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.mail_accounts a
      where a.id = mail_account_shares.account_id
        and a.org_id = public.current_user_org_id()
        and a.owner_member_id is null
        and public.mail_account_is_org_admin()
    )
  );

create policy mail_account_shares_update on public.mail_account_shares
  for update to authenticated
  using (
    exists (
      select 1
      from public.mail_accounts a
      where a.id = mail_account_shares.account_id
        and a.org_id = public.current_user_org_id()
        and a.owner_member_id is null
        and public.mail_account_is_org_admin()
    )
  )
  with check (
    exists (
      select 1
      from public.mail_accounts a
      where a.id = mail_account_shares.account_id
        and a.org_id = public.current_user_org_id()
        and a.owner_member_id is null
        and public.mail_account_is_org_admin()
    )
  );

create policy mail_account_shares_delete on public.mail_account_shares
  for delete to authenticated
  using (
    exists (
      select 1
      from public.mail_accounts a
      where a.id = mail_account_shares.account_id
        and a.org_id = public.current_user_org_id()
        and a.owner_member_id is null
        and public.mail_account_is_org_admin()
    )
  );

-- Default workspace role labels + Dev custom preset (only when rbac_config is empty).
update public.organizations
set rbac_config = jsonb_build_object(
  'presetLabels', jsonb_build_object(
    'super_admin', 'Owner',
    'admin', 'Admin',
    'user', 'Junior'
  ),
  'customPresets', jsonb_build_object(
    'dev', jsonb_build_object(
      'label', 'Dev',
      'description', 'Developer access on assigned projects',
      'basedOn', 'user',
      'scopedToAssignedProjects', true
    )
  )
)
where rbac_config = '{}'::jsonb
   or rbac_config is null;

-- mail.org.share capability in SQL presets
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
    when 'admin' then p_capability not in (
      'admin.settings.manage',
      'admin.billing.manage'
    )
    when 'user' then p_capability not like 'deal_financials.%'
      and p_capability <> 'view_amounts.show'
      and p_capability not in (
        'admin.settings.manage',
        'admin.billing.manage',
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
        'records.share',
        'people.view',
        'people.manage',
        'people.adjustments.manage',
        'time.entries.view',
        'time.entries.manage',
        'time.entries.approve',
        'payroll.view',
        'payroll.manage',
        'payroll.approve',
        'payroll.pay',
        'payroll.loans.manage',
        'reports.view',
        'support.tickets.view',
        'support.tickets.manage',
        'support.messages.send',
        'mail.org.manage',
        'mail.org.share'
      )
    when 'read_only' then p_capability in (
      'crm.contacts.view',
      'crm.companies.view',
      'crm.pipeline.view',
      'crm.tasks.view',
      'crm.notes.view',
      'calendar.view',
      'meetings.view',
      'messaging.conversations.view',
      'forms.submissions.view',
      'support.tickets.view',
      'deal_operations.resources.view',
      'people.view',
      'time.entries.view'
    )
    else false
  end;
$$;
