-- Adds referrer relationships and a free-text "other" lead source to contacts
-- so we can structure where a lead came from and surface the referrer in the
-- profiles of both the referred lead and the referrer (contact or company).

alter table public.contacts
  add column if not exists referred_by_contact_id bigint
    references public.contacts(id) on update cascade on delete set null,
  add column if not exists referred_by_company_id bigint
    references public.companies(id) on update cascade on delete set null,
  add column if not exists lead_source_other text;

create index if not exists contacts_referred_by_contact_id_idx
  on public.contacts(referred_by_contact_id)
  where referred_by_contact_id is not null;

create index if not exists contacts_referred_by_company_id_idx
  on public.contacts(referred_by_company_id)
  where referred_by_company_id is not null;

comment on column public.contacts.referred_by_contact_id is
  'When lead_source = ''Referido'' and the referrer is a person already in the CRM.';
comment on column public.contacts.referred_by_company_id is
  'When lead_source = ''Referido'' and the referrer is a company already in the CRM.';
comment on column public.contacts.lead_source_other is
  'Free-text detail captured when lead_source = ''Otro''.';

create or replace view public.contacts_summary as
select co.id,
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
    c.name as company_name,
    c.primary_contact_id is not null and c.primary_contact_id = co.id as is_primary_contact,
    count(distinct t.id) as nb_tasks,
    co.lead_source_other,
    co.referred_by_contact_id,
    co.referred_by_company_id
   from contacts co
     left join tasks t on co.id = t.contact_id
     left join companies c on co.company_id = c.id
  group by co.id, c.name, c.primary_contact_id;
