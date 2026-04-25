-- SaaS: platform operators (full-directory access), per-organization billing fields, and Stripe price defaults.
-- Hierarchy: auth.users -> sales (membership) -> organizations (workspace). RLS for tenant data uses current_user_org_id();
--   platform_operators is an allowlist of auth.users who can read/update all organizations and all sales for support/billing.
-- Default commercial model: $20 USD / user / month (seat); stripe_seat_price_id should match a Stripe Price with that amount.

-- 1) Platform operators: insert rows only via Supabase SQL editor or service_role (not from the anon/authenticated API).
create table if not exists public.platform_operators (
  user_id uuid not null primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_operators enable row level security;

-- Each user can only see their own row (to know if the Platform console is available).
drop policy if exists "platform_operators_select_self" on public.platform_operators;

create policy "platform_operators_select_self" on public.platform_operators
  for select to authenticated
  using (user_id = auth.uid());

-- 2) Helper for RLS on organizations / sales
create or replace function public.is_platform_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_operators p
    where p.user_id = auth.uid()
  );
$$;

grant execute on function public.is_platform_operator() to authenticated;

-- 3) Organization billing (Stripe + internal pricing mirror)
alter table public.organizations
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_seat_price_id text,
  add column if not exists billing_status text
    check (
      billing_status is null
      or billing_status in ('none', 'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused')
    ),
  add column if not exists billable_seat_count integer
    check (billable_seat_count is null or billable_seat_count >= 0),
  add column if not exists price_per_seat_usd_monthly numeric(10, 2) not null default 20;

-- Full read for platform operators (OR with existing per-org select).
drop policy if exists "organizations_select_platform" on public.organizations;

create policy "organizations_select_platform" on public.organizations
  for select to authenticated
  using (public.is_platform_operator());

-- Billing fields updated only from Platform console.
drop policy if exists "organizations_update_platform" on public.organizations;

create policy "organizations_update_platform" on public.organizations
  for update to authenticated
  using (public.is_platform_operator())
  with check (public.is_platform_operator());

-- 4) Sales directory for platform: see all org members (support / billing), OR existing same-org access.
drop policy if exists "sales_select_platform" on public.sales;

create policy "sales_select_platform" on public.sales
  for select to authenticated
  using (public.is_platform_operator());

-- First operator (run in SQL editor, replace email):
-- insert into public.platform_operators (user_id)
--   select id from auth.users where email = 'admin@example.com' limit 1;
