alter table if exists public.people
  add column if not exists notes text,
  add column if not exists business_name text,
  add column if not exists specialty text,
  add column if not exists compensation_mode text,
  add column if not exists default_hours_per_week numeric(8,2),
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists emergency_contact_relationship text,
  add column if not exists emergency_notes text;

alter table if exists public.people
  drop constraint if exists people_compensation_mode_check;

alter table if exists public.people
  add constraint people_compensation_mode_check
  check (compensation_mode in ('hourly', 'salary', 'mixed') or compensation_mode is null);

create index if not exists people_business_name_idx on public.people(business_name);
create index if not exists people_specialty_idx on public.people(specialty);
