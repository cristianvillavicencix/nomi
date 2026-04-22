alter table public.sales
  add column if not exists roles text[] not null default '{}';

update public.sales
set roles = array(
  select distinct role_name
  from unnest(
    coalesce(roles, '{}') ||
    case when administrator then array['admin']::text[] else array[]::text[] end
  ) as role_name
  where role_name <> ''
)
where administrator = true
   or cardinality(coalesce(roles, '{}')) > 0;

alter table public.sales
  add constraint sales_roles_allowed_check
  check (
    roles <@ array[
      'admin',
      'accountant',
      'payroll_manager',
      'hr',
      'sales_manager',
      'manager',
      'employee'
    ]::text[]
  );

create unique index if not exists sales_single_administrator_idx
  on public.sales (administrator)
  where administrator = true;
