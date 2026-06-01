-- Service catalog: category on add-ons, currency on packages and add-ons.

alter table public.service_addons
  add column if not exists category text;

alter table public.service_packages
  add column if not exists currency text not null default 'USD';

alter table public.service_addons
  add column if not exists currency text not null default 'USD';

comment on column public.service_packages.currency is
  'Suggested-price currency (ISO code). Line items on proposals may override.';
comment on column public.service_addons.currency is
  'Suggested-price currency (ISO code). Line items on proposals may override.';
comment on column public.service_addons.category is
  'Catalog grouping (design, web, seo, hosting, skop, etc.).';
