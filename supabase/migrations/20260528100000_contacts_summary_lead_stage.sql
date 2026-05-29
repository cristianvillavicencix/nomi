-- Expose lead pipeline fields on contacts_summary so the Leads Kanban can
-- read and persist column moves (lead_stage was missing from the view).

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
  co.linkedin_url,
  co.lead_source,
  co.interested_service,
  co.lead_stage,
  co.snooze_until,
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
