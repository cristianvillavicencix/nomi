-- contacts.title has existed since init_db; document LBS usage for job role at company.
alter table public.contacts
  add column if not exists title text;

comment on column public.contacts.title is
  'Job role at the company (e.g. Owner, Office manager, Estimator). Nullable.';
