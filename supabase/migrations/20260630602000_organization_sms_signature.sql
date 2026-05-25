-- Organization-level SMS signature appended to outbound client messages.

alter table public.organizations
  add column if not exists sms_signature_template text
    default '- {{user_first_name}} {{user_last_name}} | {{org_name}}',
  add column if not exists sms_signature_enabled boolean not null default true;

comment on column public.organizations.sms_signature_template is
  'Template for SMS signatures. Variables: {{user_first_name}}, {{user_last_name}}, {{user_full_name}}, {{org_name}}';

update public.organizations
set sms_signature_template = '- {{user_first_name}} {{user_last_name}} | {{org_name}}'
where sms_signature_template is null;
