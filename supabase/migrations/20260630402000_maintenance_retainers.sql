-- Maintenance retainer tracking for ongoing client work.

create table if not exists public.maintenance_retainers (
  id bigint generated always as identity primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  deal_id bigint not null references public.deals (id) on delete cascade,
  monthly_hours_included numeric(6, 2) not null default 0,
  monthly_amount numeric(10, 2) not null default 0,
  billing_day int not null default 1 check (billing_day between 1 and 28),
  start_date date not null default current_date,
  end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.maintenance_hours_log (
  id bigint generated always as identity primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  retainer_id bigint not null references public.maintenance_retainers (id) on delete cascade,
  member_id bigint references public.organization_members (id) on delete set null,
  hours_worked numeric(5, 2) not null check (hours_worked > 0),
  description text not null,
  worked_date date not null default current_date,
  billing_period date not null default date_trunc('month', current_date)::date,
  created_at timestamptz not null default now()
);

create index if not exists maintenance_retainers_deal_idx
  on public.maintenance_retainers (deal_id) where active = true;
create index if not exists maintenance_hours_log_retainer_idx
  on public.maintenance_hours_log (retainer_id, billing_period);

alter table public.maintenance_retainers enable row level security;
alter table public.maintenance_hours_log enable row level security;

grant select, insert, update, delete on public.maintenance_retainers to authenticated;
grant select, insert, update, delete on public.maintenance_hours_log to authenticated;

create policy "maintenance_retainers_select"
  on public.maintenance_retainers for select to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.can_view_deal(deal_id)
  );

create policy "maintenance_retainers_mutate"
  on public.maintenance_retainers for all to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.can_view_deal(deal_id)
    and public.current_member_has_capability('deal_financials.expenses.edit')
  )
  with check (
    org_id = public.current_user_org_id()
    and public.can_view_deal(deal_id)
  );

create policy "maintenance_hours_log_select"
  on public.maintenance_hours_log for select to authenticated
  using (org_id = public.current_user_org_id());

create policy "maintenance_hours_log_mutate"
  on public.maintenance_hours_log for all to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('deal_financials.expenses.edit')
  )
  with check (org_id = public.current_user_org_id());
