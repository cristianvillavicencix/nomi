-- Ask Nomi (CRM assistant) workspace settings.

alter table public.organizations
  add column if not exists assistant_settings jsonb not null default '{"enabled": true}'::jsonb;

comment on column public.organizations.assistant_settings is
  'CRM Ask Nomi assistant settings. Shape: { enabled: boolean }. Anthropic API key stays in Edge secrets.';
