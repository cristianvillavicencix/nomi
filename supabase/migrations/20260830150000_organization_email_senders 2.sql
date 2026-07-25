-- Separate billing vs general outbound sender addresses per organization.
alter table public.organizations
  add column if not exists billing_from_email text;

comment on column public.organizations.billing_from_email is
  'From address for invoices and payment emails (e.g. billing@lbs.bz).';
comment on column public.organizations.email is
  'General sender and reply-to for portal, meetings, and client-facing mail (e.g. info@lbs.bz).';
