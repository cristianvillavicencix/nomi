-- Project Resources Wizard: system template + per-org form instances

insert into public.form_templates (
  org_id,
  slug,
  name,
  type,
  is_system,
  schema,
  description
)
values (
  null,
  'project_resources_wizard',
  'Project Resources Wizard',
  'custom',
  true,
  '{
    "sections": [
      {
        "id": "company_info",
        "title": "Información de tu empresa",
        "description": "Vamos a empezar con lo básico",
        "fields": [
          {
            "key": "company_name",
            "type": "text",
            "label": "Nombre de la empresa",
            "required": true,
            "placeholder": "Ej: Acme Construction"
          },
          {
            "key": "industry",
            "type": "text",
            "label": "Industria o sector",
            "placeholder": "Ej: Construcción residencial",
            "required": false
          }
        ]
      },
      {
        "id": "logos",
        "title": "Logo de tu empresa",
        "description": "Subí los logos de tu empresa. Normalmente 1-3 son suficientes.",
        "fields": [
          {
            "key": "logos",
            "type": "file_multi",
            "label": "Logos",
            "required": false,
            "accept": ".jpg,.jpeg,.png,.webp,.svg,.ai,.psd,.pdf",
            "max_files": 10,
            "soft_warn_after": 5,
            "soft_warn_message": "Normalmente 1-3 logos son suficientes. ¿Continuar agregando?"
          }
        ]
      },
      {
        "id": "services",
        "title": "¿Qué servicios ofrecés?",
        "description": "Listá los servicios que ofrece tu empresa. Vamos a pedirte fotos de cada uno.",
        "fields": [
          {
            "key": "services",
            "type": "dynamic_list",
            "label": "Servicios",
            "required": true,
            "min_items": 1,
            "item_label_template": "Servicio {index}",
            "item_placeholder": "Ej: Renovación de cocinas",
            "add_button_label": "+ Agregar servicio"
          }
        ]
      },
      {
        "id": "service_photos",
        "title": "Fotos por servicio",
        "description": "Subí fotos de cada servicio. Si no tenés fotos de alguno, podés saltarlo.",
        "fields": [
          {
            "key": "service_photos",
            "type": "dynamic_file_groups",
            "depends_on": "services",
            "accept": ".jpg,.jpeg,.png,.webp,.heic,.gif,.mp4,.mov",
            "skip_button_label": "Saltar este servicio",
            "max_files_per_group": 20
          }
        ]
      }
    ],
    "settings": {
      "wizard_mode": "on",
      "show_summary_step": true
    }
  }'::jsonb,
  'Wizard interactivo para recopilar info, logo y fotos de servicios del cliente'
)
on conflict (org_id, slug) do update set
  name = excluded.name,
  schema = excluded.schema,
  description = excluded.description,
  updated_at = now();

insert into public.form_instances (
  org_id,
  template_id,
  name,
  slug,
  schema,
  is_active,
  is_public,
  notify_on_submit,
  auto_create_contact,
  auto_create_lead,
  recaptcha_enabled,
  honeypot_enabled,
  rate_limit_per_ip_per_hour,
  welcome_title,
  welcome_message,
  thank_you_title,
  thank_you_message
)
select
  o.id,
  t.id,
  'Project Resources',
  'project-resources',
  t.schema,
  true,
  true,
  true,
  false,
  false,
  true,
  true,
  10,
  'Subí los recursos de tu proyecto',
  'Te vamos a guiar paso a paso para subir logos, servicios y fotos.',
  '¡Gracias!',
  'Recibimos tus archivos. Nuestro equipo los revisará pronto.'
from public.organizations o
cross join public.form_templates t
where t.slug = 'project_resources_wizard'
  and t.is_system = true
on conflict (org_id, slug) do update set
  schema = excluded.schema,
  is_active = excluded.is_active,
  is_public = excluded.is_public,
  notify_on_submit = excluded.notify_on_submit,
  updated_at = now();
