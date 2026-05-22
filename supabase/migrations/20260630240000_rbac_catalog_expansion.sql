-- Align Postgres preset checks with expanded permissionCatalog.ts:
-- new capabilities (upload, meetings, records.share, billing, people/time/payroll)
-- read_only uses explicit allow-list (no proposals/contracts via %.view)
-- user preset denies people, payroll, record sharing

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
        'reports.view'
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
