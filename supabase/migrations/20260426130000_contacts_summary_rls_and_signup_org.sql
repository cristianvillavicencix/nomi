-- Restore security_invoker on contacts_summary so RLS on public.contacts applies (see 20260228133000_add_contact_address.sql).
-- New signups without company_name and without invite org_id must NOT land in org 1 (legacy tenant data).

drop view if exists public.contacts_summary;

create view public.contacts_summary
with (security_invoker = true)
as
select
  co.id,
  co.first_name,
  co.last_name,
  co.gender,
  co.title,
  co.email_jsonb,
  jsonb_path_query_array(co.email_jsonb, '$[*].email')::text as email_fts,
  co.phone_jsonb,
  jsonb_path_query_array(co.phone_jsonb, '$[*].number')::text as phone_fts,
  co.background,
  co.address,
  co.avatar,
  co.first_seen,
  co.last_seen,
  co.has_newsletter,
  co.status,
  co.tags,
  co.company_id,
  co.sales_id,
  co.linkedin_url,
  c.name as company_name,
  count(distinct t.id) as nb_tasks
from public.contacts co
left join public.tasks t on co.id = t.contact_id
left join public.companies c on co.company_id = c.id
group by co.id, c.name;

grant select on public.contacts_summary to authenticated;
grant select on public.contacts_summary to service_role;

-- Isolated workspace for OAuth / edge signups with no company_name and no org_id (never attach to Default org 1).
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
  v_meta_org := new.raw_user_meta_data ->> 'org_id';

  if length(v_company) > 0 then
    insert into public.organizations (name) values (v_company) returning id into v_org_id;
    insert into public.sales (first_name, last_name, email, user_id, administrator, org_id)
    values (v_first, v_last, new.email, new.id, true, v_org_id);
    return new;
  end if;

  if v_meta_org is not null and v_meta_org ~ '^[0-9]+$' then
    v_org_id := (v_meta_org)::bigint;
  else
    v_default_org_name := coalesce(
      nullif(trim(concat_ws(' ', v_first, v_last)), ''),
      trim(initcap(replace(split_part(new.email, '@', 1), '.', ' ')))
    ) || ' - Workspace';
    insert into public.organizations (name)
    values (v_default_org_name)
    returning id into v_org_id;
  end if;

  select count(*)::int into v_in_org
  from public.sales
  where org_id = v_org_id;

  insert into public.sales (first_name, last_name, email, user_id, administrator, org_id)
  values (
    v_first,
    v_last,
    new.email,
    new.id,
    case when v_in_org = 0 then true else false end,
    v_org_id
  );
  return new;
end;
$$;
