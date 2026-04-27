-- Add website field to organizations table.

alter table public.organizations
  add column if not exists website text;
