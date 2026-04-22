alter table if exists public.people
  add column if not exists annual_salary numeric(14,2),
  add column if not exists bank_account_holder_name text,
  add column if not exists bank_name text,
  add column if not exists routing_number text,
  add column if not exists account_number text,
  add column if not exists account_type text,
  add column if not exists zelle_account_holder_name text,
  add column if not exists zelle_contact text,
  add column if not exists check_pay_to_name text;

do $$
declare
  has_salary_amount boolean;
  has_salary_rate boolean;
  has_bank_account_holder boolean;
  has_bank_routing_number boolean;
  has_bank_account_number boolean;
  has_bank_account_type boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'people' and column_name = 'salary_amount'
  ) into has_salary_amount;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'people' and column_name = 'salary_rate'
  ) into has_salary_rate;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'people' and column_name = 'bank_account_holder'
  ) into has_bank_account_holder;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'people' and column_name = 'bank_routing_number'
  ) into has_bank_routing_number;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'people' and column_name = 'bank_account_number'
  ) into has_bank_account_number;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'people' and column_name = 'bank_account_type'
  ) into has_bank_account_type;

  execute format(
    'update public.people set
      annual_salary = coalesce(annual_salary, %s),
      bank_account_holder_name = coalesce(bank_account_holder_name, %s),
      routing_number = coalesce(routing_number, %s),
      account_number = coalesce(account_number, %s),
      account_type = coalesce(account_type, %s)',
    case
      when has_salary_amount then 'salary_amount'
      when has_salary_rate then 'salary_rate'
      else 'null'
    end,
    case when has_bank_account_holder then 'bank_account_holder' else 'null' end,
    case when has_bank_routing_number then 'bank_routing_number' else 'null' end,
    case when has_bank_account_number then 'bank_account_number' else 'null' end,
    case when has_bank_account_type then 'bank_account_type' else 'null' end
  );
end $$;

alter table if exists public.people
  drop constraint if exists people_account_type_check;

alter table if exists public.people
  add constraint people_account_type_check
  check (account_type in ('checking', 'savings') or account_type is null);
