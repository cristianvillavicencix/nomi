-- Expand messaging/voice capabilities in SQL preset helper (align with permissionCatalog.ts).

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
        'messaging.templates.manage',
        'messaging.assign',
        'voice.recordings.access',
        'deal_operations.subcontractors.manage',
        'deal_operations.credentials.manage',
        'reports.view'
      )
    when 'read_only' then p_capability like '%.view'
      or p_capability in (
        'calendar.view',
        'meetings.view',
        'forms.submissions.view',
        'messaging.templates.view'
      )
    else false
  end;
$$;
