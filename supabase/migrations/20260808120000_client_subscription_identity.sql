-- Human-readable subscription numbers and billing metadata (Zoho parity).

create table if not exists public.organization_client_subscription_sequences (
  org_id bigint not null references public.organizations (id) on delete cascade,
  year integer not null,
  last_number integer not null default 0 check (last_number >= 0),
  primary key (org_id, year)
);

create or replace function public.next_client_subscription_number(p_org_id bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer := extract(year from current_date)::integer;
  v_next integer;
begin
  insert into public.organization_client_subscription_sequences (org_id, year, last_number)
  values (p_org_id, v_year, 0)
  on conflict (org_id, year) do nothing;

  update public.organization_client_subscription_sequences
  set last_number = last_number + 1
  where org_id = p_org_id and year = v_year
  returning last_number into v_next;

  return 'SUB-' || v_year::text || '-' || lpad(v_next::text, 4, '0');
end;
$$;

grant execute on function public.next_client_subscription_number(bigint) to service_role;

alter table public.client_subscriptions
  add column if not exists subscription_number text,
  add column if not exists reference_number text,
  add column if not exists activated_at timestamptz,
  add column if not exists last_billed_at timestamptz;

create unique index if not exists client_subscriptions_org_number_uidx
  on public.client_subscriptions (org_id, subscription_number)
  where subscription_number is not null;

comment on column public.client_subscriptions.subscription_number is
  'Human-readable subscription id, e.g. SUB-2026-0001.';

comment on column public.client_subscriptions.reference_number is
  'Optional internal reference number (Zoho Reference#).';

comment on column public.client_subscriptions.activated_at is
  'When the subscription first became active or trialing.';

comment on column public.client_subscriptions.last_billed_at is
  'Timestamp of the most recent successful subscription cycle charge.';

-- Backfill subscription numbers for existing rows (per org, ordered by id).
do $$
declare
  r record;
  v_year integer;
  v_next integer;
begin
  for r in
    select id, org_id, created_at
    from public.client_subscriptions
    where subscription_number is null
    order by org_id, id
  loop
    v_year := extract(year from coalesce(r.created_at, now()))::integer;

    insert into public.organization_client_subscription_sequences (org_id, year, last_number)
    values (r.org_id, v_year, 0)
    on conflict (org_id, year) do nothing;

    update public.organization_client_subscription_sequences
    set last_number = last_number + 1
    where org_id = r.org_id and year = v_year
    returning last_number into v_next;

    update public.client_subscriptions
    set subscription_number = 'SUB-' || v_year::text || '-' || lpad(v_next::text, 4, '0')
    where id = r.id;
  end loop;
end;
$$;

-- Backfill activated_at for active-like subscriptions without it.
update public.client_subscriptions
set activated_at = coalesce(current_period_start, updated_at, created_at)
where activated_at is null
  and status in ('active', 'trialing', 'past_due', 'paused');

-- Backfill last_billed_at from mirrored subscription invoices.
update public.client_subscriptions cs
set last_billed_at = sub.max_paid_at
from (
  select subscription_id, max(paid_at) as max_paid_at
  from public.client_invoices
  where subscription_id is not null
    and paid_at is not null
  group by subscription_id
) sub
where cs.id = sub.subscription_id
  and cs.last_billed_at is null;

grant select, insert, update on public.organization_client_subscription_sequences to service_role;
