-- Seed project file upload form for each organization (mirrors website-intake pattern).
-- Disable org trigger: SQL Editor / migrations run without an authenticated session.

alter table public.forms disable trigger trg_assign_org_id_forms;

insert into public.forms (org_id, name, slug, description, schema, active)
select
  o.id,
  'Project Resources Upload',
  'project-resources',
  'Let clients upload logos, service photos, team images, and other project files.',
  jsonb_build_object(
    'type', 'file-upload',
    'categories', jsonb_build_array(
      'logo', 'service-photo', 'team', 'document', 'other'
    )
  ),
  true
from public.organizations o
where not exists (
  select 1 from public.forms f
  where f.slug = 'project-resources' and f.org_id = o.id
);

alter table public.forms enable trigger trg_assign_org_id_forms;

update public.forms
set
  name = 'Website & marketing intake',
  description = 'Collect website and marketing project requirements from clients.'
where slug = 'website-intake';
