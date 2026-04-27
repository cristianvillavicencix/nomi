-- Trigger: when CRM settings companyLegalName changes, sync to organizations.name.
-- Uses SECURITY DEFINER so it can update organizations regardless of RLS.

create or replace function public.sync_org_name_from_config()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id bigint;
  v_new_name text;
begin
  v_new_name := trim(NEW.config->>'companyLegalName');
  if v_new_name is null or v_new_name = '' then
    return NEW;
  end if;

  v_org_id := public.current_user_org_id();
  if v_org_id is null then
    return NEW;
  end if;

  update public.organizations
    set name = v_new_name
    where id = v_org_id;

  return NEW;
end;
$$;

drop trigger if exists sync_org_name_after_config_update on public.configuration;

create trigger sync_org_name_after_config_update
  after update on public.configuration
  for each row
  when (NEW.config->>'companyLegalName' is distinct from OLD.config->>'companyLegalName')
  execute function public.sync_org_name_from_config();
