-- Sample SMS composer shortcuts (supplements intake + quick replies).
-- Idempotent: skips orgs that already have a template with the same name.

insert into public.message_templates (
  org_id,
  name,
  body,
  language,
  channels,
  variables,
  composer_shortcut,
  shortcut_label,
  tile_color,
  shortcut_sort_order,
  is_archived
)
select
  o.id,
  seed.name,
  seed.body,
  seed.language,
  array['sms']::text[],
  seed.variables,
  seed.composer_shortcut,
  seed.shortcut_label,
  seed.tile_color,
  seed.shortcut_sort_order,
  false
from public.organizations o
cross join (
  values
    (
      'Supplements intake',
      'Hola {{contact_first_name}},

Para proceder con los suplementos necesitamos lo siguiente:

Medidas (si no las tienes, nosotros nos encargamos — tiene un costo extra)
Scope de seguro, si lo tienes
Fotos: pueden ser el link de CompanyCam o el que uses',
      'es',
      array['contact_first_name']::text[],
      true,
      'SUP',
      '#0d9488',
      0
    ),
    (
      'Quick hello',
      'Hola {{contact_first_name}}, ¿cómo estás?',
      'es',
      array['contact_first_name']::text[],
      true,
      'HOL',
      '#2563eb',
      1
    ),
    (
      'Follow up',
      'Hola {{contact_first_name}}, soy {{user_first_name}} de {{org_name}}. Solo dando seguimiento — ¿tienes alguna pregunta?',
      'es',
      array['contact_first_name', 'user_first_name', 'org_name']::text[],
      true,
      'FU',
      '#7c3aed',
      2
    ),
    (
      'Photos reminder',
      'Hola {{contact_first_name}}, cuando puedas envíanos fotos del área de trabajo. Puedes usar CompanyCam o el link que prefieras.',
      'es',
      array['contact_first_name']::text[],
      true,
      'FOT',
      '#ea580c',
      3
    )
) as seed (
  name,
  body,
  language,
  variables,
  composer_shortcut,
  shortcut_label,
  tile_color,
  shortcut_sort_order
)
where not exists (
  select 1
  from public.message_templates existing
  where existing.org_id = o.id
    and existing.name = seed.name
    and not existing.is_archived
);
