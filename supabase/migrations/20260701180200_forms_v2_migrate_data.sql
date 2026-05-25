-- Migrate existing orgs to form_instances and website_brief data to form_submissions_v2

do $$
declare
  org_record record;
  template_record record;
begin
  for org_record in select id from public.organizations loop
    for template_record in
      select * from public.form_templates where is_system = true
    loop
      insert into public.form_instances (
        org_id, template_id, name, slug, description, schema, is_active
      ) values (
        org_record.id,
        template_record.id,
        template_record.name,
        template_record.slug,
        template_record.description,
        template_record.schema,
        true
      )
      on conflict (org_id, slug) do nothing;
    end loop;
  end loop;
end $$;

insert into public.form_submissions_v2 (
  org_id, form_instance_id, answers, deal_id, status, submitted_at
)
select
  d.org_id,
  fi.id,
  d.website_brief,
  d.id,
  'new',
  coalesce(d.updated_at, d.created_at)
from public.deals d
join public.form_instances fi
  on fi.org_id = d.org_id and fi.slug = 'project_brief'
where d.website_brief is not null
  and d.website_brief <> '{}'::jsonb
  and not exists (
    select 1 from public.form_submissions_v2 fs2
    where fs2.deal_id = d.id and fs2.form_instance_id = fi.id
  );
