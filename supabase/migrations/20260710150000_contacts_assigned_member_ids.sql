-- Allow multiple team members to be assigned to the same lead/contact.

alter table public.contacts
  add column if not exists assigned_member_ids bigint[] not null default '{}';

update public.contacts
set assigned_member_ids = array[organization_member_id]::bigint[]
where organization_member_id is not null
  and coalesce(cardinality(assigned_member_ids), 0) = 0;

create index if not exists contacts_assigned_member_ids_idx
  on public.contacts using gin (assigned_member_ids);

comment on column public.contacts.assigned_member_ids is
  'Organization members assigned to this contact/lead. First entry mirrors organization_member_id.';

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
  jsonb_path_query_array(co.email_jsonb, '$[*]."email"'::jsonpath)::text as email_fts,
  co.phone_jsonb,
  jsonb_path_query_array(co.phone_jsonb, '$[*]."number"'::jsonpath)::text as phone_fts,
  co.background,
  co.address,
  co.avatar,
  co.first_seen,
  co.last_seen,
  co.has_newsletter,
  co.status,
  co.tags,
  co.company_id,
  co.organization_member_id,
  co.assigned_member_ids,
  co.linkedin_url,
  co.lead_source,
  co.interested_service,
  co.lead_stage,
  co.snooze_until,
  co.next_followup_at,
  co.last_contacted_at,
  co.lead_value_estimate,
  c.name as company_name,
  c.primary_contact_id is not null and c.primary_contact_id = co.id as is_primary_contact,
  count(distinct t.id) as nb_tasks,
  co.lead_source_other,
  co.referred_by_contact_id,
  co.referred_by_company_id
from public.contacts co
left join public.tasks t on co.id = t.contact_id
left join public.companies c on co.company_id = c.id
group by co.id, c.name, c.primary_contact_id;

grant select on public.contacts_summary to authenticated;
grant select on public.contacts_summary to service_role;
