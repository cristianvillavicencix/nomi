-- Allow multiple contract templates per org with the same version (different slugs).
-- Previously unique (org_id, version) blocked e.g. general v1.0 + web-maintenance v1.0.

alter table public.organization_contract_terms
  drop constraint if exists organization_contract_terms_org_id_version_key;

create unique index if not exists organization_contract_terms_org_slug_version_idx
  on public.organization_contract_terms (org_id, slug, version);
