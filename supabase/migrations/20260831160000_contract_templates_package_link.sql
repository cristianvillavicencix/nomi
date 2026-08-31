-- Multi-template contract library + package default link + subscription audit FK.

alter table public.organization_contract_terms
  add column if not exists slug text,
  add column if not exists is_default boolean not null default false;

-- Existing "one active" rule blocks a template library; many may be is_active.
drop index if exists public.organization_contract_terms_one_active_idx;

create unique index if not exists organization_contract_terms_one_default_idx
  on public.organization_contract_terms (org_id)
  where is_default = true;

-- Backfill: active row becomes default; slug from version or 'general'.
update public.organization_contract_terms t
set
  is_default = true,
  slug = coalesce(
    nullif(trim(t.slug), ''),
    'general'
  )
where t.is_active = true
  and not exists (
    select 1
    from public.organization_contract_terms o
    where o.org_id = t.org_id
      and o.is_default = true
      and o.id <> t.id
  );

update public.organization_contract_terms
set slug = coalesce(nullif(trim(slug), ''), 'general')
where slug is null or trim(slug) = '';

alter table public.organization_contract_terms
  alter column slug set not null;

create unique index if not exists organization_contract_terms_org_slug_idx
  on public.organization_contract_terms (org_id, slug);

alter table public.service_packages
  add column if not exists default_contract_terms_id bigint
    references public.organization_contract_terms (id) on delete set null;

alter table public.client_subscriptions
  add column if not exists agreement_contract_terms_id bigint
    references public.organization_contract_terms (id) on delete set null;
