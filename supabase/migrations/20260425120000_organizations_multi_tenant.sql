-- Multi-tenant workspaces: self-serve signup with company name, one admin per org, RLS by org_id.

-- 1) Organizations (workspaces / B2B customers)
create table if not exists public.organizations (
  id bigserial primary key,
  name text not null,
  created_at timestamptz not null default now()
);

insert into public.organizations (id, name)
values (1, 'Default organization')
on conflict (id) do nothing;

select setval(
  pg_get_serial_sequence('public.organizations', 'id'),
  (select coalesce(max(id), 1) from public.organizations)
);

-- 2) sales.org_id
alter table public.sales
  add column if not exists org_id bigint references public.organizations (id);

update public.sales set org_id = 1 where org_id is null;

alter table public.sales alter column org_id set default 1;

alter table public.sales alter column org_id set not null;

-- One full administrator per organization (replaces global single-admin index)
drop index if exists public.sales_single_administrator_idx;

create unique index if not exists sales_one_administrator_per_org_idx
  on public.sales (org_id)
  where administrator = true;

-- 3) Core CRM tables
alter table public.contacts
  add column if not exists org_id bigint references public.organizations (id);

alter table public.companies
  add column if not exists org_id bigint references public.organizations (id);

alter table public.deals
  add column if not exists org_id bigint references public.organizations (id);

update public.contacts set org_id = 1 where org_id is null;
update public.companies set org_id = 1 where org_id is null;
update public.deals set org_id = 1 where org_id is null;

alter table public.contacts alter column org_id set default 1;
alter table public.companies alter column org_id set default 1;
alter table public.deals alter column org_id set default 1;

alter table public.contacts alter column org_id set not null;
alter table public.companies alter column org_id set not null;
alter table public.deals alter column org_id set not null;

-- 4) Notes & tasks
alter table public.contact_notes
  add column if not exists org_id bigint references public.organizations (id);

alter table public.deal_notes
  add column if not exists org_id bigint references public.organizations (id);

alter table public.tasks
  add column if not exists org_id bigint references public.organizations (id);

alter table public.tags
  add column if not exists org_id bigint references public.organizations (id);

update public.contact_notes cn
set org_id = c.org_id
from public.contacts c
where cn.contact_id = c.id and cn.org_id is null;

update public.deal_notes dn
set org_id = d.org_id
from public.deals d
where dn.deal_id = d.id and dn.org_id is null;

update public.tasks t
set org_id = c.org_id
from public.contacts c
where t.contact_id = c.id and t.org_id is null;

update public.tags set org_id = 1 where org_id is null;

alter table public.contact_notes alter column org_id set default 1;
alter table public.deal_notes alter column org_id set default 1;
alter table public.tasks alter column org_id set default 1;
alter table public.tags alter column org_id set default 1;

update public.contact_notes set org_id = 1 where org_id is null;
update public.deal_notes set org_id = 1 where org_id is null;
update public.tasks set org_id = 1 where org_id is null;

alter table public.contact_notes alter column org_id set not null;
alter table public.deal_notes alter column org_id set not null;
alter table public.tasks alter column org_id set not null;
alter table public.tags alter column org_id set not null;

-- 5) FK for people / payroll org (already default 1)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'people_org_id_fkey'
  ) then
    alter table public.people
      add constraint people_org_id_fkey
      foreign key (org_id) references public.organizations (id);
  end if;
end;
$$;

-- 6) Session org helper (for RLS)
create or replace function public.current_user_org_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select s.org_id from public.sales s where s.user_id = auth.uid() limit 1;
$$;

grant execute on function public.current_user_org_id() to authenticated;

-- 7) New user trigger: new org from company_name, or join org via org_id metadata (invites)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company text;
  v_meta_org text;
  v_org_id bigint;
  v_in_org int;
  v_first text;
  v_last text;
begin
  v_first := coalesce(
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data -> 'custom_claims' ->> 'first_name',
    'Pending'
  );
  v_last := coalesce(
    new.raw_user_meta_data ->> 'last_name',
    new.raw_user_meta_data -> 'custom_claims' ->> 'last_name',
    'Pending'
  );
  v_company := trim(coalesce(new.raw_user_meta_data ->> 'company_name', ''));
  v_meta_org := new.raw_user_meta_data ->> 'org_id';

  if length(v_company) > 0 then
    insert into public.organizations (name) values (v_company) returning id into v_org_id;
    insert into public.sales (first_name, last_name, email, user_id, administrator, org_id)
    values (v_first, v_last, new.email, new.id, true, v_org_id);
    return new;
  end if;

  if v_meta_org is not null and v_meta_org ~ '^[0-9]+$' then
    v_org_id := (v_meta_org)::bigint;
  else
    v_org_id := 1;
  end if;

  select count(*)::int into v_in_org
  from public.sales
  where org_id = v_org_id;

  insert into public.sales (first_name, last_name, email, user_id, administrator, org_id)
  values (
    v_first,
    v_last,
    new.email,
    new.id,
    case when v_in_org = 0 then true else false end,
    v_org_id
  );
  return new;
end;
$$;

-- 8) RLS: replace open policies on tenant tables
drop policy if exists "Enable read access for authenticated users" on public.contacts;
drop policy if exists "Enable insert for authenticated users only" on public.contacts;
drop policy if exists "Enable update for authenticated users only" on public.contacts;

create policy "contacts_select_same_org" on public.contacts
  for select to authenticated
  using (org_id = public.current_user_org_id());

create policy "contacts_insert_same_org" on public.contacts
  for insert to authenticated
  with check (org_id = public.current_user_org_id());

create policy "contacts_update_same_org" on public.contacts
  for update to authenticated
  using (org_id = public.current_user_org_id())
  with check (org_id = public.current_user_org_id());

drop policy if exists "Enable read access for authenticated users" on public.companies;
drop policy if exists "Enable insert for authenticated users only" on public.companies;
drop policy if exists "Enable update for authenticated users only" on public.companies;
drop policy if exists "Company Delete Policy" on public.companies;

create policy "companies_select_same_org" on public.companies
  for select to authenticated
  using (org_id = public.current_user_org_id());

create policy "companies_insert_same_org" on public.companies
  for insert to authenticated
  with check (org_id = public.current_user_org_id());

create policy "companies_update_same_org" on public.companies
  for update to authenticated
  using (org_id = public.current_user_org_id())
  with check (org_id = public.current_user_org_id());

create policy "companies_delete_same_org" on public.companies
  for delete to authenticated
  using (org_id = public.current_user_org_id());

drop policy if exists "Enable read access for authenticated users" on public.deals;
drop policy if exists "Enable insert for authenticated users only" on public.deals;
drop policy if exists "Enable update for authenticated users only" on public.deals;

create policy "deals_select_same_org" on public.deals
  for select to authenticated
  using (org_id = public.current_user_org_id());

create policy "deals_insert_same_org" on public.deals
  for insert to authenticated
  with check (org_id = public.current_user_org_id());

create policy "deals_update_same_org" on public.deals
  for update to authenticated
  using (org_id = public.current_user_org_id())
  with check (org_id = public.current_user_org_id());

drop policy if exists "Enable read access for authenticated users" on public.contact_notes;
drop policy if exists "Enable insert for authenticated users only" on public.contact_notes;
drop policy if exists "Contact Notes Delete Policy" on public.contact_notes;
drop policy if exists "Contact Notes Update policy" on public.contact_notes;

create policy "contact_notes_select_same_org" on public.contact_notes
  for select to authenticated
  using (org_id = public.current_user_org_id());

create policy "contact_notes_insert_same_org" on public.contact_notes
  for insert to authenticated
  with check (org_id = public.current_user_org_id());

create policy "contact_notes_update_same_org" on public.contact_notes
  for update to authenticated
  using (org_id = public.current_user_org_id())
  with check (org_id = public.current_user_org_id());

create policy "contact_notes_delete_same_org" on public.contact_notes
  for delete to authenticated
  using (org_id = public.current_user_org_id());

drop policy if exists "Enable read access for authenticated users" on public.deal_notes;
drop policy if exists "Enable insert for authenticated users only" on public.deal_notes;
drop policy if exists "Deal Notes Delete Policy" on public.deal_notes;
drop policy if exists "Deal Notes Update policy" on public.deal_notes;

create policy "deal_notes_select_same_org" on public.deal_notes
  for select to authenticated
  using (org_id = public.current_user_org_id());

create policy "deal_notes_insert_same_org" on public.deal_notes
  for insert to authenticated
  with check (org_id = public.current_user_org_id());

create policy "deal_notes_update_same_org" on public.deal_notes
  for update to authenticated
  using (org_id = public.current_user_org_id())
  with check (org_id = public.current_user_org_id());

create policy "deal_notes_delete_same_org" on public.deal_notes
  for delete to authenticated
  using (org_id = public.current_user_org_id());

drop policy if exists "Enable read access for authenticated users" on public.tasks;
drop policy if exists "Enable insert for authenticated users only" on public.tasks;

create policy "tasks_select_same_org" on public.tasks
  for select to authenticated
  using (org_id = public.current_user_org_id());

create policy "tasks_insert_same_org" on public.tasks
  for insert to authenticated
  with check (org_id = public.current_user_org_id());

drop policy if exists "Enable read access for authenticated users" on public.tags;
drop policy if exists "Enable insert for authenticated users only" on public.tags;

create policy "tags_select_same_org" on public.tags
  for select to authenticated
  using (org_id = public.current_user_org_id());

create policy "tags_insert_same_org" on public.tags
  for insert to authenticated
  with check (org_id = public.current_user_org_id());

drop policy if exists "Enable read access for authenticated users" on public.sales;
drop policy if exists "Enable insert for authenticated users only" on public.sales;
drop policy if exists "Enable update for authenticated users only" on public.sales;

create policy "sales_select_same_org" on public.sales
  for select to authenticated
  using (org_id = public.current_user_org_id());

-- Row inserts for sales are created by handle_new_user (security definer) or service role, not RLS for authenticated

create policy "sales_update_same_org" on public.sales
  for update to authenticated
  using (org_id = public.current_user_org_id())
  with check (org_id = public.current_user_org_id());

-- People / time / payments: scope by org (columns already exist)
drop policy if exists "People insert" on public.people;
drop policy if exists "People select" on public.people;
drop policy if exists "People update" on public.people;
drop policy if exists "People delete" on public.people;

create policy "people_select_same_org" on public.people
  for select to authenticated
  using (org_id = public.current_user_org_id());

create policy "people_insert_same_org" on public.people
  for insert to authenticated
  with check (org_id = public.current_user_org_id());

create policy "people_update_same_org" on public.people
  for update to authenticated
  using (org_id = public.current_user_org_id())
  with check (org_id = public.current_user_org_id());

create policy "people_delete_same_org" on public.people
  for delete to authenticated
  using (org_id = public.current_user_org_id());

drop policy if exists "Time entries insert" on public.time_entries;
drop policy if exists "Time entries select" on public.time_entries;
drop policy if exists "Time entries update" on public.time_entries;
drop policy if exists "Time entries delete" on public.time_entries;

create policy "time_entries_select_same_org" on public.time_entries
  for select to authenticated
  using (org_id = public.current_user_org_id());

create policy "time_entries_insert_same_org" on public.time_entries
  for insert to authenticated
  with check (org_id = public.current_user_org_id());

create policy "time_entries_update_same_org" on public.time_entries
  for update to authenticated
  using (org_id = public.current_user_org_id())
  with check (org_id = public.current_user_org_id());

create policy "time_entries_delete_same_org" on public.time_entries
  for delete to authenticated
  using (org_id = public.current_user_org_id());

drop policy if exists "Payments insert" on public.payments;
drop policy if exists "Payments select" on public.payments;
drop policy if exists "Payments update" on public.payments;
drop policy if exists "Payments delete" on public.payments;

create policy "payments_select_same_org" on public.payments
  for select to authenticated
  using (org_id = public.current_user_org_id());

create policy "payments_insert_same_org" on public.payments
  for insert to authenticated
  with check (org_id = public.current_user_org_id());

create policy "payments_update_same_org" on public.payments
  for update to authenticated
  using (org_id = public.current_user_org_id())
  with check (org_id = public.current_user_org_id());

create policy "payments_delete_same_org" on public.payments
  for delete to authenticated
  using (org_id = public.current_user_org_id());

drop policy if exists "Payment lines insert" on public.payment_lines;
drop policy if exists "Payment lines select" on public.payment_lines;
drop policy if exists "Payment lines update" on public.payment_lines;
drop policy if exists "Payment lines delete" on public.payment_lines;

create policy "payment_lines_select_same_org" on public.payment_lines
  for select to authenticated
  using (
    exists (
      select 1 from public.payments p
      where p.id = payment_lines.payment_id
        and p.org_id = public.current_user_org_id()
    )
  );

create policy "payment_lines_insert_same_org" on public.payment_lines
  for insert to authenticated
  with check (
    exists (
      select 1 from public.payments p
      where p.id = payment_lines.payment_id
        and p.org_id = public.current_user_org_id()
    )
  );

create policy "payment_lines_update_same_org" on public.payment_lines
  for update to authenticated
  using (
    exists (
      select 1 from public.payments p
      where p.id = payment_lines.payment_id
        and p.org_id = public.current_user_org_id()
    )
  )
  with check (
    exists (
      select 1 from public.payments p
      where p.id = payment_lines.payment_id
        and p.org_id = public.current_user_org_id()
    )
  );

create policy "payment_lines_delete_same_org" on public.payment_lines
  for delete to authenticated
  using (
    exists (
      select 1 from public.payments p
      where p.id = payment_lines.payment_id
        and p.org_id = public.current_user_org_id()
    )
  );

-- Tags: update + delete
drop policy if exists "Enable update for authenticated users only" on public.tags;
drop policy if exists "Enable delete for authenticated users only" on public.tags;

create policy "tags_update_same_org" on public.tags
  for update to authenticated
  using (org_id = public.current_user_org_id())
  with check (org_id = public.current_user_org_id());

create policy "tags_delete_same_org" on public.tags
  for delete to authenticated
  using (org_id = public.current_user_org_id());

-- Deal module (scoped via deals.org_id)
drop policy if exists "Deal salespersons insert" on public.deal_salespersons;
drop policy if exists "Deal salespersons select" on public.deal_salespersons;
drop policy if exists "Deal salespersons update" on public.deal_salespersons;
drop policy if exists "Deal salespersons delete" on public.deal_salespersons;
drop policy if exists "Deal subcontractors insert" on public.deal_subcontractors;
drop policy if exists "Deal subcontractors select" on public.deal_subcontractors;
drop policy if exists "Deal subcontractors update" on public.deal_subcontractors;
drop policy if exists "Deal subcontractors delete" on public.deal_subcontractors;
drop policy if exists "Deal workers insert" on public.deal_workers;
drop policy if exists "Deal workers select" on public.deal_workers;
drop policy if exists "Deal workers update" on public.deal_workers;
drop policy if exists "Deal workers delete" on public.deal_workers;
drop policy if exists "Deal cost entries insert" on public.deal_cost_entries;
drop policy if exists "Deal cost entries select" on public.deal_cost_entries;
drop policy if exists "Deal cost entries update" on public.deal_cost_entries;
drop policy if exists "Deal cost entries delete" on public.deal_cost_entries;

-- deal_salespersons
create policy "deal_sp_select" on public.deal_salespersons for select to authenticated
  using (exists (select 1 from public.deals d where d.id = deal_salespersons.deal_id and d.org_id = public.current_user_org_id()));
create policy "deal_sp_insert" on public.deal_salespersons for insert to authenticated
  with check (exists (select 1 from public.deals d where d.id = deal_salespersons.deal_id and d.org_id = public.current_user_org_id()));
create policy "deal_sp_update" on public.deal_salespersons for update to authenticated
  using (exists (select 1 from public.deals d where d.id = deal_salespersons.deal_id and d.org_id = public.current_user_org_id()))
  with check (exists (select 1 from public.deals d where d.id = deal_salespersons.deal_id and d.org_id = public.current_user_org_id()));
create policy "deal_sp_delete" on public.deal_salespersons for delete to authenticated
  using (exists (select 1 from public.deals d where d.id = deal_salespersons.deal_id and d.org_id = public.current_user_org_id()));

-- deal_subcontractors
create policy "deal_sc_select" on public.deal_subcontractors for select to authenticated
  using (exists (select 1 from public.deals d where d.id = deal_subcontractors.deal_id and d.org_id = public.current_user_org_id()));
create policy "deal_sc_insert" on public.deal_subcontractors for insert to authenticated
  with check (exists (select 1 from public.deals d where d.id = deal_subcontractors.deal_id and d.org_id = public.current_user_org_id()));
create policy "deal_sc_update" on public.deal_subcontractors for update to authenticated
  using (exists (select 1 from public.deals d where d.id = deal_subcontractors.deal_id and d.org_id = public.current_user_org_id()))
  with check (exists (select 1 from public.deals d where d.id = deal_subcontractors.deal_id and d.org_id = public.current_user_org_id()));
create policy "deal_sc_delete" on public.deal_subcontractors for delete to authenticated
  using (exists (select 1 from public.deals d where d.id = deal_subcontractors.deal_id and d.org_id = public.current_user_org_id()));

-- deal_workers
create policy "deal_wk_select" on public.deal_workers for select to authenticated
  using (exists (select 1 from public.deals d where d.id = deal_workers.deal_id and d.org_id = public.current_user_org_id()));
create policy "deal_wk_insert" on public.deal_workers for insert to authenticated
  with check (exists (select 1 from public.deals d where d.id = deal_workers.deal_id and d.org_id = public.current_user_org_id()));
create policy "deal_wk_update" on public.deal_workers for update to authenticated
  using (exists (select 1 from public.deals d where d.id = deal_workers.deal_id and d.org_id = public.current_user_org_id()))
  with check (exists (select 1 from public.deals d where d.id = deal_workers.deal_id and d.org_id = public.current_user_org_id()));
create policy "deal_wk_delete" on public.deal_workers for delete to authenticated
  using (exists (select 1 from public.deals d where d.id = deal_workers.deal_id and d.org_id = public.current_user_org_id()));

-- deal_cost_entries
create policy "deal_ce_select" on public.deal_cost_entries for select to authenticated
  using (exists (select 1 from public.deals d where d.id = deal_cost_entries.deal_id and d.org_id = public.current_user_org_id()));
create policy "deal_ce_insert" on public.deal_cost_entries for insert to authenticated
  with check (exists (select 1 from public.deals d where d.id = deal_cost_entries.deal_id and d.org_id = public.current_user_org_id()));
create policy "deal_ce_update" on public.deal_cost_entries for update to authenticated
  using (exists (select 1 from public.deals d where d.id = deal_cost_entries.deal_id and d.org_id = public.current_user_org_id()))
  with check (exists (select 1 from public.deals d where d.id = deal_cost_entries.deal_id and d.org_id = public.current_user_org_id()));
create policy "deal_ce_delete" on public.deal_cost_entries for delete to authenticated
  using (exists (select 1 from public.deals d where d.id = deal_cost_entries.deal_id and d.org_id = public.current_user_org_id()));

-- Payroll runs (has org_id)
drop policy if exists "Payroll runs insert" on public.payroll_runs;
drop policy if exists "Payroll runs select" on public.payroll_runs;
drop policy if exists "Payroll runs update" on public.payroll_runs;
drop policy if exists "Payroll runs delete" on public.payroll_runs;

create policy "payroll_runs_select" on public.payroll_runs
  for select to authenticated using (org_id = public.current_user_org_id());
create policy "payroll_runs_insert" on public.payroll_runs
  for insert to authenticated with check (org_id = public.current_user_org_id());
create policy "payroll_runs_update" on public.payroll_runs
  for update to authenticated
  using (org_id = public.current_user_org_id()) with check (org_id = public.current_user_org_id());
create policy "payroll_runs_delete" on public.payroll_runs
  for delete to authenticated using (org_id = public.current_user_org_id());

-- Payroll run lines: via parent run
drop policy if exists "Payroll run lines insert" on public.payroll_run_lines;
drop policy if exists "Payroll run lines select" on public.payroll_run_lines;
drop policy if exists "Payroll run lines update" on public.payroll_run_lines;
drop policy if exists "Payroll run lines delete" on public.payroll_run_lines;

create policy "payroll_run_lines_select" on public.payroll_run_lines
  for select to authenticated using (
    exists (select 1 from public.payroll_runs r where r.id = payroll_run_lines.payroll_run_id and r.org_id = public.current_user_org_id())
  );
create policy "payroll_run_lines_insert" on public.payroll_run_lines
  for insert to authenticated with check (
    exists (select 1 from public.payroll_runs r where r.id = payroll_run_lines.payroll_run_id and r.org_id = public.current_user_org_id())
  );
create policy "payroll_run_lines_update" on public.payroll_run_lines
  for update to authenticated
  using (
    exists (select 1 from public.payroll_runs r where r.id = payroll_run_lines.payroll_run_id and r.org_id = public.current_user_org_id())
  ) with check (
    exists (select 1 from public.payroll_runs r where r.id = payroll_run_lines.payroll_run_id and r.org_id = public.current_user_org_id())
  );
create policy "payroll_run_lines_delete" on public.payroll_run_lines
  for delete to authenticated using (
    exists (select 1 from public.payroll_runs r where r.id = payroll_run_lines.payroll_run_id and r.org_id = public.current_user_org_id())
  );

-- Employee loans: scope via people.org_id
drop policy if exists "Employee loans insert" on public.employee_loans;
drop policy if exists "Employee loans select" on public.employee_loans;
drop policy if exists "Employee loans update" on public.employee_loans;
drop policy if exists "Employee loans delete" on public.employee_loans;

create policy "employee_loans_select" on public.employee_loans
  for select to authenticated using (
    exists (select 1 from public.people p where p.id = employee_loans.employee_id and p.org_id = public.current_user_org_id())
  );
create policy "employee_loans_insert" on public.employee_loans
  for insert to authenticated with check (
    exists (select 1 from public.people p where p.id = employee_loans.employee_id and p.org_id = public.current_user_org_id())
  );
create policy "employee_loans_update" on public.employee_loans
  for update to authenticated
  using (
    exists (select 1 from public.people p where p.id = employee_loans.employee_id and p.org_id = public.current_user_org_id())
  ) with check (
    exists (select 1 from public.people p where p.id = employee_loans.employee_id and p.org_id = public.current_user_org_id())
  );
create policy "employee_loans_delete" on public.employee_loans
  for delete to authenticated using (
    exists (select 1 from public.people p where p.id = employee_loans.employee_id and p.org_id = public.current_user_org_id())
  );

-- Loan deductions: via loan
drop policy if exists "Employee loan deductions insert" on public.employee_loan_deductions;
drop policy if exists "Employee loan deductions select" on public.employee_loan_deductions;
drop policy if exists "Employee loan deductions update" on public.employee_loan_deductions;
drop policy if exists "Employee loan deductions delete" on public.employee_loan_deductions;

create policy "employee_loan_deductions_select" on public.employee_loan_deductions
  for select to authenticated using (
    exists (
      select 1
      from public.employee_loans el
      join public.people p on p.id = el.employee_id
      where el.id = employee_loan_deductions.loan_id
        and p.org_id = public.current_user_org_id()
    )
  );
create policy "employee_loan_deductions_insert" on public.employee_loan_deductions
  for insert to authenticated with check (
    exists (
      select 1
      from public.employee_loans el
      join public.people p on p.id = el.employee_id
      where el.id = employee_loan_deductions.loan_id
        and p.org_id = public.current_user_org_id()
    )
  );
create policy "employee_loan_deductions_update" on public.employee_loan_deductions
  for update to authenticated
  using (
    exists (
      select 1
      from public.employee_loans el
      join public.people p on p.id = el.employee_id
      where el.id = employee_loan_deductions.loan_id
        and p.org_id = public.current_user_org_id()
    )
  ) with check (
    exists (
      select 1
      from public.employee_loans el
      join public.people p on p.id = el.employee_id
      where el.id = employee_loan_deductions.loan_id
        and p.org_id = public.current_user_org_id()
    )
  );
create policy "employee_loan_deductions_delete" on public.employee_loan_deductions
  for delete to authenticated using (
    exists (
      select 1
      from public.employee_loans el
      join public.people p on p.id = el.employee_id
      where el.id = employee_loan_deductions.loan_id
        and p.org_id = public.current_user_org_id()
    )
  );

-- Auto-assign org on insert from session
create or replace function public.trg_assign_org_id_from_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_org bigint;
begin
  v_org := public.current_user_org_id();
  if v_org is null then
    raise exception 'Not authenticated for org scoping';
  end if;
  if TG_OP = 'INSERT' then
    new.org_id := v_org;
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_contacts_assign_org on public.contacts;
create trigger trg_contacts_assign_org
  before insert on public.contacts
  for each row execute function public.trg_assign_org_id_from_session();

drop trigger if exists trg_companies_assign_org on public.companies;
create trigger trg_companies_assign_org
  before insert on public.companies
  for each row execute function public.trg_assign_org_id_from_session();

drop trigger if exists trg_deals_assign_org on public.deals;
create trigger trg_deals_assign_org
  before insert on public.deals
  for each row execute function public.trg_assign_org_id_from_session();

drop trigger if exists trg_contact_notes_assign_org on public.contact_notes;
create trigger trg_contact_notes_assign_org
  before insert on public.contact_notes
  for each row execute function public.trg_assign_org_id_from_session();

drop trigger if exists trg_deal_notes_assign_org on public.deal_notes;
create trigger trg_deal_notes_assign_org
  before insert on public.deal_notes
  for each row execute function public.trg_assign_org_id_from_session();

drop trigger if exists trg_tasks_assign_org on public.tasks;
create trigger trg_tasks_assign_org
  before insert on public.tasks
  for each row execute function public.trg_assign_org_id_from_session();

drop trigger if exists trg_tags_assign_org on public.tags;
create trigger trg_tags_assign_org
  before insert on public.tags
  for each row execute function public.trg_assign_org_id_from_session();

drop trigger if exists trg_people_assign_org on public.people;
create trigger trg_people_assign_org
  before insert on public.people
  for each row execute function public.trg_assign_org_id_from_session();

drop trigger if exists trg_time_entries_assign_org on public.time_entries;
create trigger trg_time_entries_assign_org
  before insert on public.time_entries
  for each row execute function public.trg_assign_org_id_from_session();

drop trigger if exists trg_payments_assign_org on public.payments;
create trigger trg_payments_assign_org
  before insert on public.payments
  for each row execute function public.trg_assign_org_id_from_session();

drop trigger if exists trg_payroll_runs_assign_org on public.payroll_runs;
create trigger trg_payroll_runs_assign_org
  before insert on public.payroll_runs
  for each row execute function public.trg_assign_org_id_from_session();

-- Project detail tables (deal_id → deals.org_id)
drop policy if exists "Deal subcontractor entries insert" on public.deal_subcontractor_entries;
drop policy if exists "Deal subcontractor entries select" on public.deal_subcontractor_entries;
drop policy if exists "Deal subcontractor entries update" on public.deal_subcontractor_entries;
drop policy if exists "Deal subcontractor entries delete" on public.deal_subcontractor_entries;
drop policy if exists "Deal expenses insert" on public.deal_expenses;
drop policy if exists "Deal expenses select" on public.deal_expenses;
drop policy if exists "Deal expenses update" on public.deal_expenses;
drop policy if exists "Deal expenses delete" on public.deal_expenses;
drop policy if exists "Deal change orders insert" on public.deal_change_orders;
drop policy if exists "Deal change orders select" on public.deal_change_orders;
drop policy if exists "Deal change orders update" on public.deal_change_orders;
drop policy if exists "Deal change orders delete" on public.deal_change_orders;
drop policy if exists "Deal commissions insert" on public.deal_commissions;
drop policy if exists "Deal commissions select" on public.deal_commissions;
drop policy if exists "Deal commissions update" on public.deal_commissions;
drop policy if exists "Deal commissions delete" on public.deal_commissions;
drop policy if exists "Deal client payments insert" on public.deal_client_payments;
drop policy if exists "Deal client payments select" on public.deal_client_payments;
drop policy if exists "Deal client payments update" on public.deal_client_payments;
drop policy if exists "Deal client payments delete" on public.deal_client_payments;

-- Reuse same deal-org pattern (abbreviated names to stay under identifier limits)
create policy "dse_select" on public.deal_subcontractor_entries for select to authenticated
  using (exists (select 1 from public.deals d where d.id = deal_subcontractor_entries.deal_id and d.org_id = public.current_user_org_id()));
create policy "dse_insert" on public.deal_subcontractor_entries for insert to authenticated
  with check (exists (select 1 from public.deals d where d.id = deal_subcontractor_entries.deal_id and d.org_id = public.current_user_org_id()));
create policy "dse_update" on public.deal_subcontractor_entries for update to authenticated
  using (exists (select 1 from public.deals d where d.id = deal_subcontractor_entries.deal_id and d.org_id = public.current_user_org_id()))
  with check (exists (select 1 from public.deals d where d.id = deal_subcontractor_entries.deal_id and d.org_id = public.current_user_org_id()));
create policy "dse_delete" on public.deal_subcontractor_entries for delete to authenticated
  using (exists (select 1 from public.deals d where d.id = deal_subcontractor_entries.deal_id and d.org_id = public.current_user_org_id()));

create policy "dex_select" on public.deal_expenses for select to authenticated
  using (exists (select 1 from public.deals d where d.id = deal_expenses.deal_id and d.org_id = public.current_user_org_id()));
create policy "dex_insert" on public.deal_expenses for insert to authenticated
  with check (exists (select 1 from public.deals d where d.id = deal_expenses.deal_id and d.org_id = public.current_user_org_id()));
create policy "dex_update" on public.deal_expenses for update to authenticated
  using (exists (select 1 from public.deals d where d.id = deal_expenses.deal_id and d.org_id = public.current_user_org_id()))
  with check (exists (select 1 from public.deals d where d.id = deal_expenses.deal_id and d.org_id = public.current_user_org_id()));
create policy "dex_delete" on public.deal_expenses for delete to authenticated
  using (exists (select 1 from public.deals d where d.id = deal_expenses.deal_id and d.org_id = public.current_user_org_id()));

create policy "dco_select" on public.deal_change_orders for select to authenticated
  using (exists (select 1 from public.deals d where d.id = deal_change_orders.deal_id and d.org_id = public.current_user_org_id()));
create policy "dco_insert" on public.deal_change_orders for insert to authenticated
  with check (exists (select 1 from public.deals d where d.id = deal_change_orders.deal_id and d.org_id = public.current_user_org_id()));
create policy "dco_update" on public.deal_change_orders for update to authenticated
  using (exists (select 1 from public.deals d where d.id = deal_change_orders.deal_id and d.org_id = public.current_user_org_id()))
  with check (exists (select 1 from public.deals d where d.id = deal_change_orders.deal_id and d.org_id = public.current_user_org_id()));
create policy "dco_delete" on public.deal_change_orders for delete to authenticated
  using (exists (select 1 from public.deals d where d.id = deal_change_orders.deal_id and d.org_id = public.current_user_org_id()));

create policy "dcm_select" on public.deal_commissions for select to authenticated
  using (exists (select 1 from public.deals d where d.id = deal_commissions.deal_id and d.org_id = public.current_user_org_id()));
create policy "dcm_insert" on public.deal_commissions for insert to authenticated
  with check (exists (select 1 from public.deals d where d.id = deal_commissions.deal_id and d.org_id = public.current_user_org_id()));
create policy "dcm_update" on public.deal_commissions for update to authenticated
  using (exists (select 1 from public.deals d where d.id = deal_commissions.deal_id and d.org_id = public.current_user_org_id()))
  with check (exists (select 1 from public.deals d where d.id = deal_commissions.deal_id and d.org_id = public.current_user_org_id()));
create policy "dcm_delete" on public.deal_commissions for delete to authenticated
  using (exists (select 1 from public.deals d where d.id = deal_commissions.deal_id and d.org_id = public.current_user_org_id()));

create policy "dcp_select" on public.deal_client_payments for select to authenticated
  using (exists (select 1 from public.deals d where d.id = deal_client_payments.deal_id and d.org_id = public.current_user_org_id()));
create policy "dcp_insert" on public.deal_client_payments for insert to authenticated
  with check (exists (select 1 from public.deals d where d.id = deal_client_payments.deal_id and d.org_id = public.current_user_org_id()));
create policy "dcp_update" on public.deal_client_payments for update to authenticated
  using (exists (select 1 from public.deals d where d.id = deal_client_payments.deal_id and d.org_id = public.current_user_org_id()))
  with check (exists (select 1 from public.deals d where d.id = deal_client_payments.deal_id and d.org_id = public.current_user_org_id()));
create policy "dcp_delete" on public.deal_client_payments for delete to authenticated
  using (exists (select 1 from public.deals d where d.id = deal_client_payments.deal_id and d.org_id = public.current_user_org_id()));
