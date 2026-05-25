-- Add team photos step to Project Resources wizard (after logos)

do $$
declare
  team_section jsonb := '{
    "id": "team",
    "title": "Fotos del equipo",
    "description": "Subí fotos del equipo, staff y personas de la empresa.",
    "fields": [{
      "key": "team_photos",
      "type": "file_multi",
      "label": "Team photos",
      "required": false,
      "accept": ".jpg,.jpeg,.png,.webp,.heic,.gif",
      "max_files": 20
    }]
  }'::jsonb;
begin
  update public.form_templates
  set schema = jsonb_set(
    schema,
    '{sections}',
    (
      select coalesce(jsonb_agg(section order by sort_key), '[]'::jsonb)
      from (
        select section, ordinality as sort_key
        from jsonb_array_elements(schema->'sections') with ordinality as t(section, ordinality)
        where section->>'id' <> 'team'
        union all
        select team_section, 9999
      ) ordered
    ),
    updated_at = now()
  )
  where slug = 'project_resources_wizard'
    and is_system = true
    and not exists (
      select 1
      from jsonb_array_elements(schema->'sections') section
      where section->>'id' = 'team'
    );

  update public.form_instances fi
  set schema = t.schema,
      updated_at = now()
  from public.form_templates t
  where fi.slug = 'project-resources'
    and t.slug = 'project_resources_wizard'
    and t.is_system = true;
end $$;
