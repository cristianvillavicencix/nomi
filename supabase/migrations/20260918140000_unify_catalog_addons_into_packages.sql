-- Unify service_addons into service_packages (one-time + recurring catalog).
-- Keeps service_addons table and addon_id FKs for audit; deactivates migrated rows.

create table if not exists public.service_catalog_addon_migrations (
  org_id bigint not null references public.organizations (id) on delete cascade,
  old_addon_id bigint not null references public.service_addons (id) on delete cascade,
  new_package_id bigint not null references public.service_packages (id) on delete cascade,
  migrated_at timestamptz not null default now(),
  primary key (old_addon_id)
);

create index if not exists service_catalog_addon_migrations_org_idx
  on public.service_catalog_addon_migrations (org_id);

-- Copy addons that do not already exist as a package (match org + name + billing_type).
insert into public.service_packages (
  org_id,
  name,
  description,
  suggested_price,
  currency,
  billing_type,
  billing_interval,
  category,
  active,
  sort_order
)
select
  a.org_id,
  a.name,
  a.description,
  a.suggested_price,
  coalesce(a.currency, 'USD'),
  a.billing_type,
  a.billing_interval,
  a.category,
  a.active,
  a.sort_order
from public.service_addons a
where not exists (
  select 1
  from public.service_packages p
  where p.org_id = a.org_id
    and p.name = a.name
    and p.billing_type = a.billing_type
);

-- Record old_addon_id -> new_package_id for every addon row.
insert into public.service_catalog_addon_migrations (org_id, old_addon_id, new_package_id)
select
  a.org_id,
  a.id,
  p.id
from public.service_addons a
inner join public.service_packages p
  on p.org_id = a.org_id
  and p.name = a.name
  and p.billing_type = a.billing_type
on conflict (old_addon_id) do nothing;

-- Backfill proposal and invoice line package_id from migrated addons.
update public.proposal_line_items pli
set package_id = m.new_package_id
from public.service_catalog_addon_migrations m
where pli.addon_id = m.old_addon_id
  and pli.package_id is null;

update public.client_invoice_line_items cil
set package_id = m.new_package_id
from public.service_catalog_addon_migrations m
where cil.addon_id = m.old_addon_id
  and cil.package_id is null;

-- Backfill client_subscriptions.line_items jsonb (addon_id -> package_id).
do $$
declare
  sub record;
  migrated jsonb;
begin
  for sub in
    select cs.id, cs.line_items
    from public.client_subscriptions cs
    where jsonb_typeof(cs.line_items) = 'array'
      and jsonb_array_length(cs.line_items) > 0
  loop
    select coalesce(
      jsonb_agg(
        case
          when (elem ->> 'addon_id') is not null
            and (
              (elem ->> 'package_id') is null
              or (elem ->> 'package_id') = 'null'
            )
            and m.new_package_id is not null
          then (elem - 'addon_id') || jsonb_build_object('package_id', m.new_package_id)
          else elem
        end
        order by ord
      ),
      '[]'::jsonb
    )
    into migrated
    from jsonb_array_elements(sub.line_items) with ordinality as t(elem, ord)
    left join public.service_catalog_addon_migrations m
      on m.old_addon_id = (elem ->> 'addon_id')::bigint;

    if migrated is distinct from sub.line_items then
      update public.client_subscriptions
      set line_items = migrated
      where id = sub.id;
    end if;
  end loop;
end;
$$;

-- Deactivate addons that were migrated into packages.
update public.service_addons a
set
  active = false,
  updated_at = now()
from public.service_catalog_addon_migrations m
where a.id = m.old_addon_id;

comment on table public.service_catalog_addon_migrations is
  'Maps legacy service_addons rows to unified service_packages after catalog merge.';
