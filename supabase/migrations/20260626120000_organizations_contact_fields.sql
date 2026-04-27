-- Add contact fields to organizations for the SAS platform console.
alter table public.organizations
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists address text;
