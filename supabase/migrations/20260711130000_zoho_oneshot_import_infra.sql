-- =====================================================================
-- Zoho one-shot import infrastructure (Fase 2)
-- =====================================================================
-- Stores per-org OAuth credentials for the Zoho CRM API plus staging
-- tables that hold raw JSON payloads from Zoho. The actual promotion
-- into canonical contacts/companies/deals happens in a second step
-- (so we can re-run with dedup logic, and so we have an audit trail of
-- exactly what arrived from Zoho).
--
-- Flow:
--   1. POST /functions/v1/zoho_oneshot_import/setup-credentials
--      → exchanges Zoho grant_token for refresh+access tokens, stores them.
--   2. POST /functions/v1/zoho_oneshot_import/test-connection
--      → uses refresh token to fetch 5 Zoho contacts (sanity check).
--   3. POST /functions/v1/zoho_oneshot_import/sync-all
--      → pages through Zoho Contacts/Accounts/Deals into the *_raw tables.
--   4. POST /functions/v1/zoho_oneshot_import/promote { dry_run? }
--      → promotes from *_raw into canonical tables with dedup.
--
-- After backfill the *_raw tables stay around for audit and to detect
-- duplicates on a re-import.
--
-- All four tables: RLS enabled, default-deny for authenticated users.
-- Only service_role (used by the edge function) can read/write.
-- =====================================================================

-- 1. OAuth credentials (1 row per org)
create table if not exists public.zoho_oauth_credentials (
  id                       bigserial   primary key,
  org_id                   bigint      not null
    references public.organizations (id) on delete cascade,
  region                   text        not null default 'com',
  access_token             text,
  refresh_token            text        not null,
  access_token_expires_at  timestamptz,
  api_domain               text,
  scope                    text,
  last_refreshed_at        timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint zoho_oauth_credentials_region_check
    check (region in ('com', 'eu', 'in', 'au', 'jp', 'cn', 'ca')),
  unique (org_id)
);

comment on table public.zoho_oauth_credentials is
  'OAuth credentials for Zoho CRM API, one row per org. Refresh token does not auto-expire; access token is refreshed on demand via Zoho /oauth/v2/token.';
comment on column public.zoho_oauth_credentials.region is
  'Zoho data center: com (USA), eu, in, au, jp, cn, ca.';
comment on column public.zoho_oauth_credentials.api_domain is
  'API base URL returned by Zoho during the OAuth exchange (e.g. https://www.zohoapis.com).';

create or replace function public.tg_zoho_oauth_credentials_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_zoho_oauth_credentials_updated_at on public.zoho_oauth_credentials;
create trigger trg_zoho_oauth_credentials_updated_at
  before update on public.zoho_oauth_credentials
  for each row execute function public.tg_zoho_oauth_credentials_set_updated_at();

-- 2. Staging table for Zoho Contacts
create table if not exists public.zoho_contacts_raw (
  id                   bigserial   primary key,
  org_id               bigint      not null
    references public.organizations (id) on delete cascade,
  zoho_id              text        not null,
  payload              jsonb       not null,
  imported_at          timestamptz not null default now(),
  promoted_at          timestamptz,
  promoted_contact_id  bigint
    references public.contacts (id) on delete set null,
  promotion_error      text,
  unique (org_id, zoho_id)
);

create index if not exists zoho_contacts_raw_unpromoted_idx
  on public.zoho_contacts_raw (org_id)
  where promoted_at is null;

create index if not exists zoho_contacts_raw_promoted_contact_idx
  on public.zoho_contacts_raw (promoted_contact_id)
  where promoted_contact_id is not null;

-- 3. Staging table for Zoho Accounts (companies)
create table if not exists public.zoho_accounts_raw (
  id                    bigserial   primary key,
  org_id                bigint      not null
    references public.organizations (id) on delete cascade,
  zoho_id               text        not null,
  payload               jsonb       not null,
  imported_at           timestamptz not null default now(),
  promoted_at           timestamptz,
  promoted_company_id   bigint
    references public.companies (id) on delete set null,
  promotion_error       text,
  unique (org_id, zoho_id)
);

create index if not exists zoho_accounts_raw_unpromoted_idx
  on public.zoho_accounts_raw (org_id)
  where promoted_at is null;

create index if not exists zoho_accounts_raw_promoted_company_idx
  on public.zoho_accounts_raw (promoted_company_id)
  where promoted_company_id is not null;

-- 4. Staging table for Zoho Deals
create table if not exists public.zoho_deals_raw (
  id                bigserial   primary key,
  org_id            bigint      not null
    references public.organizations (id) on delete cascade,
  zoho_id           text        not null,
  payload           jsonb       not null,
  imported_at       timestamptz not null default now(),
  promoted_at       timestamptz,
  promoted_deal_id  bigint
    references public.deals (id) on delete set null,
  promotion_error   text,
  unique (org_id, zoho_id)
);

create index if not exists zoho_deals_raw_unpromoted_idx
  on public.zoho_deals_raw (org_id)
  where promoted_at is null;

create index if not exists zoho_deals_raw_promoted_deal_idx
  on public.zoho_deals_raw (promoted_deal_id)
  where promoted_deal_id is not null;

-- 5. RLS — deny everything for authenticated users by default. The edge
-- function uses service_role (bypasses RLS).
alter table public.zoho_oauth_credentials enable row level security;
alter table public.zoho_contacts_raw      enable row level security;
alter table public.zoho_accounts_raw      enable row level security;
alter table public.zoho_deals_raw         enable row level security;

-- (No policies created → no authenticated user can SELECT/INSERT/UPDATE/DELETE.
--  Only the service role bypasses RLS and the edge function uses that key.)
