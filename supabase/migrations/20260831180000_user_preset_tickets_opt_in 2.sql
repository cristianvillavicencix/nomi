-- Standard User preset: tickets are opt-in via Settings (not on by default).

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
        'support.messages.send'
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

-- Reset default-on ticket caps for existing User preset members (re-enable per user in Settings).
update public.organization_members om
set module_permissions = coalesce(om.module_permissions, '{}'::jsonb)
  || jsonb_build_object(
    'support.tickets.view', false,
    'support.tickets.manage', false,
    'support.messages.send', false
  )
where not om.administrator
  and coalesce(om.module_permissions ->> '_role_preset', '') = 'user';
