-- Lead follow-up tracking fields used by pipeline stage transitions and Anti-Olvido.

alter table public.contacts
  add column if not exists next_followup_at timestamptz,
  add column if not exists last_contacted_at timestamptz,
  add column if not exists lead_value_estimate numeric(12, 2);

create index if not exists contacts_next_followup_at_idx
  on public.contacts (next_followup_at)
  where next_followup_at is not null;

comment on column public.contacts.next_followup_at is
  'When this lead should be followed up next (Anti-Olvido + pipeline transitions).';
comment on column public.contacts.last_contacted_at is
  'Last time the team reached out to this lead.';
comment on column public.contacts.lead_value_estimate is
  'Estimated deal value while the contact is still a lead.';

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
