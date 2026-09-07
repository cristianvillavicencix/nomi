-- Do not join an organization from user_metadata.org_id (client-writable).
-- Invites must set app_metadata.org_id (service role) or move the member after insert.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company text;
  v_meta_org text;
  v_org_id bigint;
  v_in_org int;
  v_first text;
  v_last text;
  v_default_org_name text;
begin
  v_first := coalesce(
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data -> 'custom_claims' ->> 'first_name',
    'Pending'
  );
  v_last := coalesce(
    new.raw_user_meta_data ->> 'last_name',
    new.raw_user_meta_data -> 'custom_claims' ->> 'last_name',
    'Pending'
  );
  v_company := trim(coalesce(new.raw_user_meta_data ->> 'company_name', ''));
  v_meta_org := new.raw_app_meta_data ->> 'org_id';

  if v_meta_org is not null and v_meta_org ~ '^[0-9]+$' then
    v_org_id := (v_meta_org)::bigint;
    if exists (select 1 from public.organizations where id = v_org_id) then
      select count(*)::int into v_in_org
      from public.organization_members
      where org_id = v_org_id;

      insert into public.organization_members (
        first_name, last_name, email, user_id, administrator, org_id
      )
      values (
        v_first,
        v_last,
        new.email,
        new.id,
        case when v_in_org = 0 then true else false end,
        v_org_id
      );
      return new;
    end if;
  end if;

  if length(v_company) > 0 then
    insert into public.organizations (name) values (v_company) returning id into v_org_id;
    insert into public.organization_members (
      first_name, last_name, email, user_id, administrator, org_id
    )
    values (v_first, v_last, new.email, new.id, true, v_org_id);
    return new;
  end if;

  v_default_org_name := coalesce(
    nullif(trim(concat_ws(' ', v_first, v_last)), ''),
    trim(initcap(replace(split_part(new.email, '@', 1), '.', ' ')))
  ) || ' - Workspace';
  insert into public.organizations (name)
  values (v_default_org_name)
  returning id into v_org_id;

  insert into public.organization_members (
    first_name, last_name, email, user_id, administrator, org_id
  )
  values (v_first, v_last, new.email, new.id, true, v_org_id);
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
