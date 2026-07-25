-- Per-channel pause for system email (billing vs general).

alter table public.organizations
  add column if not exists general_email_enabled boolean not null default true,
  add column if not exists billing_email_enabled boolean not null default true;

comment on column public.organizations.general_email_enabled is
  'When false, portal codes, meetings, and other general system mail are not sent.';
comment on column public.organizations.billing_email_enabled is
  'When false, invoices, payment links, and billing reminders are not sent.';
