alter table "public"."contacts"
add column if not exists "address" text;

drop view if exists "public"."contacts_summary";

create view "public"."contacts_summary" as
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
from contacts co
left join tasks t on co.id = t.contact_id
left join companies c on co.company_id = c.id
group by co.id, c.name;
