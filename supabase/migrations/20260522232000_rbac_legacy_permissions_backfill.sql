-- Tighten legacy RLS: derive capabilities from roles[] when module_permissions is null.
-- Backfill _role_preset for existing non-admin members so UI and Postgres stay aligned.

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

update public.organization_members om
set module_permissions = jsonb_build_object(
  '_role_preset',
  public.infer_member_role_preset_from_legacy(
    om.administrator,
    coalesce(om.roles, array[]::text[])
  )
)
where om.module_permissions is null
  and om.administrator is not true;
