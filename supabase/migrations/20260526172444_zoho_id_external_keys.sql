-- Add Zoho external keys to canonical CRM tables so the one-shot import
-- can match raw Zoho rows back to their promoted counterparts on every
-- subsequent /promote call (idempotency).
--
-- Aditive only: nullable column + partial unique index. Safe to apply
-- multiple times.

alter table public.companies add column if not exists zoho_id text;
alter table public.contacts  add column if not exists zoho_id text;
alter table public.deals     add column if not exists zoho_id text;

create unique index if not exists companies_org_zoho_id_uidx
  on public.companies(org_id, zoho_id) where zoho_id is not null;
create unique index if not exists contacts_org_zoho_id_uidx
  on public.contacts(org_id, zoho_id) where zoho_id is not null;
create unique index if not exists deals_org_zoho_id_uidx
  on public.deals(org_id, zoho_id) where zoho_id is not null;

comment on column public.companies.zoho_id is 'Zoho CRM Account id (external key for one-shot import idempotency)';
comment on column public.contacts.zoho_id  is 'Zoho CRM Contact id (external key for one-shot import idempotency)';
comment on column public.deals.zoho_id     is 'Zoho CRM Deal id (external key for one-shot import idempotency)';
