-- Unified service catalog: ticket billing products managed in Settings.

alter table public.service_packages
  add column if not exists ticket_billing_enabled boolean not null default false,
  add column if not exists ticket_pricing_mode text not null default 'flat'
    check (ticket_pricing_mode in ('flat', 'supplement_lines')),
  add column if not exists ticket_billing_slug text;

comment on column public.service_packages.ticket_billing_enabled is
  'When true, package appears in ticket deliverable billing picker.';
comment on column public.service_packages.ticket_pricing_mode is
  'flat = suggested_price per item; supplement_lines = line-count pricing (supplements).';
comment on column public.service_packages.ticket_billing_slug is
  'Stable key for legacy billing_kind sync (e.g. roof, weather_report).';

create unique index if not exists service_packages_org_ticket_slug_uidx
  on public.service_packages (org_id, ticket_billing_slug)
  where ticket_billing_slug is not null;

alter table public.ticket_deliverables
  add column if not exists service_package_id bigint references public.service_packages (id) on delete set null;

comment on column public.ticket_deliverables.service_package_id is
  'Catalog package used for billing this deliverable.';

-- Relax legacy billing_kind enum so new catalog slugs are allowed.
alter table public.ticket_deliverables
  drop constraint if exists ticket_deliverables_billing_kind_check;

-- Seed default ticket billing products per org (skip if slug already exists).
insert into public.service_packages (
  org_id,
  name,
  description,
  suggested_price,
  currency,
  billing_type,
  category,
  active,
  sort_order,
  ticket_billing_enabled,
  ticket_pricing_mode,
  ticket_billing_slug
)
select
  o.id,
  v.name,
  v.description,
  v.suggested_price,
  'USD',
  'one_time',
  'tickets',
  true,
  v.sort_order,
  true,
  v.ticket_pricing_mode,
  v.ticket_billing_slug
from public.organizations o
cross join (
  values
    (
      'Supplement',
      'Xactimate supplement scoped to the property address.',
      150::numeric,
      1,
      'supplement_lines',
      'supplement'
    ),
    (
      'Roof measurements',
      'Roof measurement deliverable.',
      25::numeric,
      2,
      'flat',
      'roof'
    ),
    (
      'Siding measurements',
      'Siding measurement deliverable.',
      50::numeric,
      3,
      'flat',
      'siding'
    ),
    (
      'ESX creation',
      'ESX file creation for the property.',
      40::numeric,
      4,
      'flat',
      'esx'
    ),
    (
      'PDF analysis',
      'PDF analysis for the claim file.',
      10::numeric,
      5,
      'flat',
      'pdf_analysis'
    )
) as v(name, description, suggested_price, sort_order, ticket_pricing_mode, ticket_billing_slug)
where not exists (
  select 1
  from public.service_packages sp
  where sp.org_id = o.id
    and sp.ticket_billing_slug = v.ticket_billing_slug
);

-- Link existing deliverables to catalog rows when slug matches.
update public.ticket_deliverables td
set service_package_id = sp.id
from public.service_packages sp
where td.service_package_id is null
  and td.billing_kind is not null
  and td.billing_kind = sp.ticket_billing_slug
  and td.org_id = sp.org_id
  and sp.ticket_billing_enabled = true;
