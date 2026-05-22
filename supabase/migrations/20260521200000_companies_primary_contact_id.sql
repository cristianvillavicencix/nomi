-- Persist explicit primary contact on companies (LBS client profile model).
alter table public.companies
  add column if not exists primary_contact_id bigint references public.contacts (id) on delete set null;

create index if not exists companies_primary_contact_id_idx
  on public.companies (primary_contact_id);

drop view if exists public.companies_summary;

create view public.companies_summary
with (security_invoker = on)
as
select
  c.id,
  c.created_at,
  c.name,
  c.sector,
  c.size,
  c.linkedin_url,
  c.website,
  c.phone_number,
  c.address,
  c.zipcode,
  c.city,
  c.state_abbr,
  c.organization_member_id,
  c.context_links,
  c.country,
  c.description,
  c.revenue,
  c.tax_identifier,
  c.logo,
  c.org_id,
  coalesce(c.primary_contact_id, pc.resolved_primary_contact_id) as primary_contact_id,
  (
    select count(*)::bigint
    from public.deals d
    where d.company_id = c.id
  ) as nb_deals,
  (
    select count(*)::bigint
    from public.contacts co
    where co.company_id = c.id
  ) as nb_contacts,
  pc.primary_contact_first_name,
  pc.primary_contact_last_name,
  pc.primary_contact_status,
  pc.primary_contact_email_jsonb,
  pc.primary_contact_phone_jsonb,
  pc.primary_contact_lead_source,
  pc.primary_contact_interested_service
from public.companies c
left join lateral (
  select
    pco.id as resolved_primary_contact_id,
    pco.first_name as primary_contact_first_name,
    pco.last_name as primary_contact_last_name,
    pco.status as primary_contact_status,
    pco.email_jsonb as primary_contact_email_jsonb,
    pco.phone_jsonb as primary_contact_phone_jsonb,
    pco.lead_source as primary_contact_lead_source,
    pco.interested_service as primary_contact_interested_service
  from public.contacts pco
  where pco.company_id = c.id
    and (c.primary_contact_id is null or pco.id = c.primary_contact_id)
  order by
    case when c.primary_contact_id is not null and pco.id = c.primary_contact_id then 0 else 1 end,
    case when pco.status = 'client' then 0 else 1 end,
    pco.first_seen asc nulls last,
    pco.id asc
  limit 1
) pc on true;

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
  co.organization_member_id,
  co.linkedin_url,
  co.lead_source,
  co.interested_service,
  c.name as company_name,
  (c.primary_contact_id is not null and c.primary_contact_id = co.id) as is_primary_contact,
  count(distinct t.id) as nb_tasks
from public.contacts co
left join public.tasks t on co.id = t.contact_id
left join public.companies c on co.company_id = c.id
group by co.id, c.name, c.primary_contact_id;

grant select on public.contacts_summary to authenticated;
grant select on public.contacts_summary to service_role;
