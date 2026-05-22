-- User / read-only presets must never see monetary amounts, even when legacy
-- module_permissions stored view_amounts.show = true without _role_preset.

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

  preset := coalesce(
    nullif(perms ->> '_role_preset', ''),
    public.infer_member_role_preset_from_legacy(
      member_row.administrator,
      coalesce(member_row.roles, array[]::text[])
    )
  );

  if p_capability = 'view_amounts.show'
    and preset in ('user', 'read_only') then
    return false;
  end if;

  if perms ? p_capability then
    return coalesce((perms ->> p_capability)::boolean, false);
  end if;

  return public.member_has_capability_from_preset(preset, p_capability);
end;
$$;

-- Backfill missing _role_preset on legacy rows (not only null module_permissions).
update public.organization_members om
set module_permissions = coalesce(om.module_permissions, '{}'::jsonb)
  || jsonb_build_object(
    '_role_preset',
    public.infer_member_role_preset_from_legacy(
      om.administrator,
      coalesce(om.roles, array[]::text[])
    )
  )
where not om.administrator
  and coalesce(om.module_permissions ->> '_role_preset', '') = '';

update public.organization_members om
set module_permissions = coalesce(om.module_permissions, '{}'::jsonb)
  || jsonb_build_object('view_amounts.show', false)
where not om.administrator
  and coalesce(om.module_permissions ->> '_role_preset', '') in ('user', 'read_only')
  and coalesce(om.module_permissions ->> 'view_amounts.show', '') = 'true';

update public.organization_members om
set module_permissions = coalesce(om.module_permissions, '{}'::jsonb)
  || jsonb_build_object('_scoped_to_projects', true)
where not om.administrator
  and coalesce(om.module_permissions ->> '_role_preset', '') = 'user'
  and coalesce(om.module_permissions ->> '_scoped_to_projects', '') <> 'true';
