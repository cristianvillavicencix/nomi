alter table if exists public.people
  add column if not exists bank_account_holder text,
  add column if not exists bank_account_type text,
  add column if not exists bank_routing_number text,
  add column if not exists bank_account_number text;

alter table if exists public.people
  drop constraint if exists people_bank_account_type_check;

alter table if exists public.people
  add constraint people_bank_account_type_check
  check (bank_account_type in ('checking', 'savings') or bank_account_type is null);

update public.people
set compensation_mode = 'hourly'
where compensation_mode = 'mixed';

alter table if exists public.people
  drop constraint if exists people_compensation_mode_check;

alter table if exists public.people
  add constraint people_compensation_mode_check
  check (compensation_mode in ('hourly', 'salary', 'day_rate') or compensation_mode is null);
