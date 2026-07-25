-- Public self-serve booking: SMS links, calendar events, optional lead capture.

alter table public.organizations
  add column if not exists booking_settings jsonb not null default jsonb_build_object(
    'enabled', true,
    'timezone_label', 'America/New_York',
    'slot_times', jsonb_build_array('09:00', '11:00', '14:00', '16:00'),
    'duration_minutes', 30,
    'booking_horizon_days', 30,
    'page_title', 'Schedule with us'
  );

comment on column public.organizations.booking_settings is
  'Public booking page config: slots, timezone label, horizon, branding.';

alter table public.service_packages
  add column if not exists booking_enabled boolean not null default false;

comment on column public.service_packages.booking_enabled is
  'When true, package appears on the public Book Now page.';

create table if not exists public.public_booking_tokens (
  id bigint generated always as identity primary key,
  token text not null unique,
  short_code text not null unique,
  org_id bigint not null references public.organizations (id) on delete cascade,
  organization_member_id bigint references public.organization_members (id) on delete set null,
  contact_id bigint references public.contacts (id) on delete set null,
  company_id bigint references public.companies (id) on delete set null,
  deal_id bigint references public.deals (id) on delete set null,
  expires_at timestamptz,
  created_by_member_id bigint references public.organization_members (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists public_booking_tokens_token_idx
  on public.public_booking_tokens (token);

create index if not exists public_booking_tokens_short_code_idx
  on public.public_booking_tokens (short_code);

create table if not exists public.public_bookings (
  id bigint generated always as identity primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  booking_token_id bigint references public.public_booking_tokens (id) on delete set null,
  service_package_id bigint references public.service_packages (id) on delete set null,
  service_name text not null,
  organization_member_id bigint references public.organization_members (id) on delete set null,
  contact_id bigint references public.contacts (id) on delete set null,
  calendar_event_id bigint references public.calendar_events (id) on delete set null,
  guest_name text not null,
  guest_company text,
  guest_phone text,
  guest_email text,
  event_date date not null,
  event_time time not null,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists public_bookings_org_created_idx
  on public.public_bookings (org_id, created_at desc);

alter table public.public_booking_tokens enable row level security;
alter table public.public_bookings enable row level security;

grant select, insert, update, delete on public.public_booking_tokens to authenticated;
grant select, insert, update, delete on public.public_bookings to authenticated;
grant all on public.public_booking_tokens to service_role;
grant all on public.public_bookings to service_role;

create policy "public_booking_tokens_org_scoped"
  on public.public_booking_tokens for all to authenticated
  using (org_id = public.current_user_org_id())
  with check (org_id = public.current_user_org_id());

create policy "public_bookings_org_scoped"
  on public.public_bookings for all to authenticated
  using (org_id = public.current_user_org_id())
  with check (org_id = public.current_user_org_id());

-- Enable booking for common LBS catalog categories (existing rows only).
update public.service_packages
set booking_enabled = true
where active = true
  and category in ('web', 'marketing');
