-- Backfill deal_resources.logo rows from website_brief.logo_file when missing.

insert into public.deal_resources (
  org_id,
  deal_id,
  category,
  label,
  file,
  visibility,
  mime_kind,
  source
)
select
  d.org_id,
  d.id,
  'logo',
  coalesce(
    d.website_brief #>> '{logo_file,original_name}',
    d.website_brief #>> '{logo_file,name}',
    'Logo'
  ),
  jsonb_build_object(
    'title',
    coalesce(
      d.website_brief #>> '{logo_file,original_name}',
      d.website_brief #>> '{logo_file,name}',
      'Logo'
    ),
    'type',
    coalesce(
      d.website_brief #>> '{logo_file,mime_type}',
      d.website_brief #>> '{logo_file,type}',
      'application/octet-stream'
    ),
    'path',
    d.website_brief #>> '{logo_file,path}',
    'src',
    coalesce(d.website_brief #>> '{logo_file,url}', ''),
    'bucket',
    coalesce(d.website_brief #>> '{logo_file,bucket}', 'attachments')
  ),
  'internal',
  case
    when coalesce(
      d.website_brief #>> '{logo_file,mime_type}',
      d.website_brief #>> '{logo_file,type}',
      ''
    ) like 'image/%' then 'image'
    else 'other'
  end,
  'project_brief'
from public.deals d
where jsonb_typeof(d.website_brief -> 'logo_file') = 'object'
  and coalesce(d.website_brief #>> '{logo_file,path}', '') <> ''
  and not exists (
    select 1
    from public.deal_resources dr
    where dr.deal_id = d.id
      and dr.category = 'logo'
      and dr.file ->> 'path' = d.website_brief #>> '{logo_file,path}'
  );
