-- Clarify team photos step: ask for name + role per photo (UI stores on deal_resources.label).

do $$
begin
  update public.form_templates
  set schema = jsonb_set(
    schema,
    '{sections}',
    (
      select coalesce(jsonb_agg(
        case
          when section->>'id' = 'team' then
            jsonb_set(
              jsonb_set(
                section,
                '{title}',
                '"Team photos"'::jsonb
              ),
              '{description}',
              '"Add photos of people on the team. For each photo, include their name and role at the company."'::jsonb
            )
          else section
        end
        order by ordinality
      ), '[]'::jsonb)
      from jsonb_array_elements(schema->'sections') with ordinality as t(section, ordinality)
    ),
    true
  ),
  updated_at = now()
  where slug = 'project_resources_wizard'
    and is_system = true;

  update public.form_instances fi
  set schema = t.schema,
      updated_at = now()
  from public.form_templates t
  where fi.slug = 'project-resources'
    and t.slug = 'project_resources_wizard'
    and t.is_system = true;
end $$;
