-- Add optional Before & After step to Project Resources wizard (after service photos).

update public.form_templates
set
  schema = jsonb_set(
    schema,
    '{sections}',
    (schema -> 'sections') || '[
      {
        "id": "before_after",
        "title": "Before & After photos",
        "description": "Optional. Select the services where you have before and after transformation photos.",
        "fields": [
          {
            "key": "before_after_photos",
            "type": "before_after_photos",
            "depends_on": "services",
            "accept": ".jpg,.jpeg,.png,.webp,.heic,.gif",
            "max_files_per_group": 10
          }
        ]
      }
    ]'::jsonb
  ),
  updated_at = now()
where slug = 'project_resources_wizard'
  and is_system = true
  and not exists (
    select 1
    from jsonb_array_elements(schema -> 'sections') section
    where section ->> 'id' = 'before_after'
  );

update public.form_instances fi
set
  schema = t.schema,
  updated_at = now()
from public.form_templates t
where t.slug = 'project_resources_wizard'
  and t.is_system = true
  and fi.slug = 'project-resources'
  and fi.template_id = t.id;
