-- Cap project-resources public form uploads:
-- logos 4, team 3, service photos 10/service, before/after 5 pairs/service.
with updated as (
  select
    fi.id,
    jsonb_set(
      fi.schema,
      '{sections}',
      (
        select coalesce(jsonb_agg(
          case
            when section ->> 'id' = 'logos' then
              jsonb_set(
                section,
                '{fields}',
                (
                  select coalesce(jsonb_agg(
                    case
                      when field ->> 'key' = 'logos' then
                        field || jsonb_build_object(
                          'max_files', 4,
                          'soft_warn_after', 4,
                          'soft_warn_message', 'Up to 4 logo files.'
                        )
                      else field
                    end
                  ), '[]'::jsonb)
                  from jsonb_array_elements(coalesce(section -> 'fields', '[]'::jsonb)) field
                )
              )
            when section ->> 'id' = 'team' then
              jsonb_set(
                section,
                '{fields}',
                (
                  select coalesce(jsonb_agg(
                    case
                      when field ->> 'key' = 'team_photos' then
                        field || jsonb_build_object('max_files', 3)
                      else field
                    end
                  ), '[]'::jsonb)
                  from jsonb_array_elements(coalesce(section -> 'fields', '[]'::jsonb)) field
                )
              )
            when section ->> 'id' = 'service_photos' then
              jsonb_set(
                section,
                '{fields}',
                (
                  select coalesce(jsonb_agg(
                    case
                      when field ->> 'key' = 'service_photos' then
                        field || jsonb_build_object('max_files_per_group', 10)
                      else field
                    end
                  ), '[]'::jsonb)
                  from jsonb_array_elements(coalesce(section -> 'fields', '[]'::jsonb)) field
                )
              )
            when section ->> 'id' = 'before_after' then
              jsonb_set(
                section,
                '{fields}',
                (
                  select coalesce(jsonb_agg(
                    case
                      when field ->> 'key' = 'before_after_photos' then
                        field || jsonb_build_object('max_files_per_group', 5)
                      else field
                    end
                  ), '[]'::jsonb)
                  from jsonb_array_elements(coalesce(section -> 'fields', '[]'::jsonb)) field
                )
              )
            else section
          end
          order by ordinality
        ), '[]'::jsonb)
        from jsonb_array_elements(coalesce(fi.schema -> 'sections', '[]'::jsonb))
          with ordinality as t(section, ordinality)
      )
    ) as next_schema
  from public.form_instances fi
  where fi.slug = 'project-resources'
)
update public.form_instances fi
set schema = updated.next_schema
from updated
where fi.id = updated.id;
