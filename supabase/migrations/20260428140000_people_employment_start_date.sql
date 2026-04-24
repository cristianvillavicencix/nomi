alter table public.people
  add column if not exists employment_start_date date;

comment on column public.people.employment_start_date is
  'First day on the job (onboarding), not the company pay calendar — pay cadence is org Payment Settings.';
