-- Align project_brief form schema with contractor brief wizard (Spanish sections)

do $$
declare
  contractor_schema jsonb := $schema${
  "sections": [
    {
      "id": "confirm_data",
      "title": "Confirma tus datos",
      "description": "Ya tenemos algunos de tus datos. Por favor confírmalos o complétalos si falta algo.",
      "fields": [
        {"key": "contact_name", "type": "text", "label": "Nombre de contacto", "required": true},
        {"key": "contact_email", "type": "email", "label": "Email de contacto", "required": true},
        {"key": "contact_phone", "type": "phone", "label": "Teléfono de contacto", "required": true},
        {"key": "company_name", "type": "text", "label": "Nombre de la empresa", "required": true},
        {"key": "business_email", "type": "email", "label": "Email del negocio", "required": false},
        {"key": "business_phone", "type": "phone", "label": "Teléfono del negocio", "required": false},
        {"key": "full_address", "type": "textarea", "label": "Dirección completa", "required": true},
        {"key": "license_number", "type": "text", "label": "Número de licencia (si aplica)", "required": false},
        {"key": "facebook_url", "type": "url", "label": "Facebook (URL)", "required": false},
        {"key": "instagram_url", "type": "url", "label": "Instagram (URL)", "required": false},
        {"key": "google_business_url", "type": "url", "label": "Google Business Profile (URL)", "required": false},
        {"key": "nextdoor_url", "type": "url", "label": "Nextdoor (URL)", "required": false},
        {"key": "thumbtack_url", "type": "url", "label": "Thumbtack (URL)", "required": false},
        {"key": "yelp_url", "type": "url", "label": "Yelp (URL)", "required": false},
        {"key": "tiktok_url", "type": "url", "label": "TikTok (URL)", "required": false},
        {"key": "existing_website", "type": "url", "label": "Sitio web actual (si tiene uno)", "required": false}
      ]
    },
    {
      "id": "about_business",
      "title": "Sobre tu negocio",
      "fields": [
        {"key": "company_founded_year", "type": "number", "label": "Año de fundación de la empresa", "required": false},
        {"key": "years_experience", "type": "number", "label": "Años de experiencia en el oficio", "required": false},
        {"key": "licensed_insured", "type": "multi_select", "label": "¿Estás licenciado/asegurado?", "required": false,
         "options": ["Licenciado", "Asegurado", "Bonded", "Aún no, en proceso"]},
        {"key": "service_areas", "type": "textarea", "label": "Áreas / ciudades donde trabajas", "required": false},
        {"key": "business_hours", "type": "textarea", "label": "Horario de atención (días + horas)", "required": false}
      ]
    },
    {
      "id": "services",
      "title": "Tus servicios",
      "fields": [
        {"key": "services_offered", "type": "multi_select", "label": "Servicios ofrecidos", "required": false,
         "options": ["Roof Repairs", "Roof Replacements", "Chimney Repairs", "Siding Repairs", "Siding Replacements",
           "Vinyl Siding Installation", "Deck Repairs", "Deck Replacements", "New Deck Construction",
           "Composite Decking (Trex)", "Railing Systems", "Gutter Cleaning", "Gutter Repairs", "Gutter Replacements",
           "Gutter Installation", "Exterior Painting", "Interior Painting", "Power Washing", "Exterior Renovations",
           "General Home Improvements", "Otros"]},
        {"key": "other_services", "type": "text", "label": "Otros servicios", "required": false,
         "visible_when": {"operator": "and", "conditions": [{"field": "services_offered", "op": "contains", "value": "Otros"}]}},
        {"key": "primary_service", "type": "text", "label": "Servicio principal / más rentable", "required": false,
         "help_text": "Elige uno de los servicios que marcaste arriba."},
        {"key": "free_offers", "type": "multi_select", "label": "¿Ofreces inspecciones o estimados gratis?", "required": false,
         "options": ["Inspección gratis", "Estimado gratis", "Ambos", "Ninguno"]},
        {"key": "insurance_claims", "type": "radio", "label": "¿Trabajas con seguros / claims?", "required": false,
         "options": ["Sí", "No"]},
        {"key": "accepts_xactimate", "type": "radio", "label": "¿Aceptas Xactimate?", "required": false,
         "options": ["Sí", "No"],
         "visible_when": {"operator": "and", "conditions": [{"field": "insurance_claims", "op": "equals", "value": "Sí"}]}},
        {"key": "differentiators", "type": "textarea", "label": "Qué te hace diferente de la competencia", "required": false,
         "help_text": "Sugerimos 3–5 razones."}
      ]
    },
    {
      "id": "contact_preferences",
      "title": "Cómo quieres que te contacten",
      "fields": [
        {"key": "preferred_contact_methods", "type": "multi_select", "label": "Mejor forma de contacto", "required": false,
         "options": ["Llamada telefónica", "SMS / texto", "WhatsApp", "Formulario web", "Email"]},
        {"key": "form_notification_email", "type": "email", "label": "Email para recibir formularios del sitio", "required": false},
        {"key": "whatsapp_business", "type": "phone", "label": "Número de WhatsApp Business", "required": false}
      ]
    },
    {
      "id": "visual_content",
      "title": "Contenido visual",
      "fields": [
        {"key": "logo_file", "type": "file", "label": "Logo", "required": false, "accept": ".jpg,.jpeg,.png,.webp,.svg"},
        {"key": "project_photos_option", "type": "radio", "label": "¿Tienes fotos de proyectos terminados?", "required": false,
         "options": ["Sí, las subiré ahora", "Sí, están en mi Instagram/Facebook", "No tengo, usen fotos profesionales (stock)"]},
        {"key": "project_photos_files", "type": "file_multi", "label": "Sube fotos de proyectos", "required": false,
         "accept": ".jpg,.jpeg,.png,.webp,.heic", "max_files": 20,
         "visible_when": {"operator": "and", "conditions": [{"field": "project_photos_option", "op": "equals", "value": "Sí, las subiré ahora"}]}},
        {"key": "before_after_photos", "type": "radio", "label": "¿Tienes fotos antes y después?", "required": false,
         "options": ["Sí", "No"]},
        {"key": "team_photos", "type": "radio", "label": "¿Tienes fotos del equipo / camiones / uniformes?", "required": false,
         "options": ["Sí", "No"]}
      ]
    },
    {
      "id": "language_audience",
      "title": "Idioma y audiencia del sitio",
      "fields": [
        {"key": "site_language", "type": "radio", "label": "Idioma del sitio web", "required": false,
         "options": ["Inglés", "Español", "Bilingüe (ambos)"]},
        {"key": "target_customers", "type": "multi_select", "label": "Cliente típico", "required": false,
         "options": ["Homeowners", "Property managers", "Comercial", "Otro"]},
        {"key": "target_customers_other", "type": "text", "label": "Otro tipo de cliente", "required": false,
         "visible_when": {"operator": "and", "conditions": [{"field": "target_customers", "op": "contains", "value": "Otro"}]}}
      ]
    },
    {
      "id": "brand_style",
      "title": "Marca y estilo",
      "fields": [
        {"key": "brand_colors_option", "type": "radio", "label": "¿Tienes colores de marca específicos?", "required": false,
         "options": ["Sí", "No, usen los del logo"]},
        {"key": "brand_colors", "type": "text", "label": "Colores de marca (hex o descripción)", "required": false,
         "visible_when": {"operator": "and", "conditions": [{"field": "brand_colors_option", "op": "equals", "value": "Sí"}]}},
        {"key": "reference_site_1", "type": "url", "label": "Sitio web de referencia #1", "required": false},
        {"key": "reference_site_2", "type": "url", "label": "Sitio web de referencia #2", "required": false},
        {"key": "reference_site_3", "type": "url", "label": "Sitio web de referencia #3", "required": false},
        {"key": "site_exclusions", "type": "textarea", "label": "¿Hay algo que NO quieres en tu sitio?", "required": false}
      ]
    },
    {
      "id": "extras",
      "title": "Extras",
      "fields": [
        {"key": "wants_blog", "type": "radio", "label": "¿Quieres blog en tu sitio?", "required": false,
         "options": ["Sí", "No"]},
        {"key": "client_notes", "type": "textarea", "label": "Notas adicionales", "required": false},
        {"key": "brief_confirmation", "type": "checkbox",
         "label": "Confirmo que la información proporcionada es precisa y autorizo su uso para el desarrollo de mi sitio web.",
         "required": true}
      ]
    }
  ]
}$schema$::jsonb;
begin
  update public.form_templates
  set schema = contractor_schema,
      updated_at = now()
  where is_system = true
    and slug = 'project_brief';

  update public.form_instances fi
  set schema = contractor_schema,
      updated_at = now()
  where fi.slug = 'project_brief';
end $$;
