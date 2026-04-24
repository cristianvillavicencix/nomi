-- Align stored app title with Nomi CRM for deployments that still have the old default.
update public.configuration
set
  config = jsonb_set(
    config,
    '{title}',
    to_jsonb('Nomi CRM'::text),
    true
  )
where
  id = 1
  and config->>'title' = 'Atomic CRM';

update public.configuration
set
  config = jsonb_set(
    config,
    '{companyLegalName}',
    to_jsonb('Nomi CRM'::text),
    true
  )
where
  id = 1
  and config->>'companyLegalName' = 'Atomic CRM';
