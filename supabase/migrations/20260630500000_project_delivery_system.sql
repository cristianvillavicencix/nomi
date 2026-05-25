-- Project delivery system: client portal handoff, credentials sharing, audit.

create table if not exists public.project_deliveries (
  id bigint generated always as identity primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  deal_id bigint not null references public.deals (id) on delete cascade,
  delivered_at timestamptz not null default now(),
  delivered_by_member_id bigint references public.organization_members (id) on delete set null,
  site_url text,
  plan_name text,
  project_start_date date,
  delivery_date date not null default current_date,
  hosting_renewal_date date,
  hosting_status text not null default 'active' check (
    hosting_status in ('active', 'expired', 'pending')
  ),
  site_language text,
  included_pages jsonb not null default '[]'::jsonb,
  maintenance_plan jsonb not null default '{}'::jsonb,
  enabled_sections jsonb not null default '[]'::jsonb,
  domain_info jsonb not null default '{}'::jsonb,
  marketing_info jsonb not null default '{}'::jsonb,
  onboarding_info jsonb not null default '{}'::jsonb,
  checklist_snapshot jsonb not null default '{}'::jsonb,
  notify_email boolean not null default true,
  notify_whatsapp boolean not null default false,
  notify_portal boolean not null default true,
  summary_pdf_path text,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists project_deliveries_active_deal_idx
  on public.project_deliveries (deal_id)
  where revoked_at is null;

create index if not exists project_deliveries_org_idx
  on public.project_deliveries (org_id, delivered_at desc);

create table if not exists public.project_delivery_domains (
  id bigint generated always as identity primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  delivery_id bigint not null references public.project_deliveries (id) on delete cascade,
  deal_id bigint not null references public.deals (id) on delete cascade,
  domain text not null,
  registrar text,
  registered_at date,
  renewal_date date,
  managed_by text not null default 'lbs' check (managed_by in ('lbs', 'client')),
  auto_renew boolean not null default true,
  dns_servers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.project_delivery_corporate_emails (
  id bigint generated always as identity primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  delivery_id bigint not null references public.project_deliveries (id) on delete cascade,
  deal_id bigint not null references public.deals (id) on delete cascade,
  email text not null,
  password_encrypted bytea,
  has_password boolean not null default false,
  config_notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.project_delivery_log (
  id bigint generated always as identity primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  deal_id bigint not null references public.deals (id) on delete cascade,
  delivery_id bigint references public.project_deliveries (id) on delete set null,
  action text not null,
  actor_member_id bigint references public.organization_members (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.project_delivery_notifications (
  id bigint generated always as identity primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  portal_account_id bigint not null references public.client_portal_accounts (id) on delete cascade,
  deal_id bigint not null references public.deals (id) on delete cascade,
  delivery_id bigint references public.project_deliveries (id) on delete cascade,
  notification_type text not null default 'delivery_ready',
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists project_delivery_notifications_account_idx
  on public.project_delivery_notifications (portal_account_id, read_at, created_at desc);

create table if not exists public.client_credential_access_log (
  id bigint generated always as identity primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  deal_id bigint not null references public.deals (id) on delete cascade,
  access_entry_id bigint references public.deal_access_entries (id) on delete set null,
  portal_account_id bigint references public.client_portal_accounts (id) on delete set null,
  action text not null check (action in ('view', 'copy')),
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.deal_access_entries
  add column if not exists shared_with_client boolean not null default false,
  add column if not exists managed_by text not null default 'lbs'
    check (managed_by in ('lbs', 'client')),
  add column if not exists service_kind text,
  add column if not exists portal_sort_order int not null default 0,
  add column if not exists password_updated_at timestamptz;

alter table public.project_deliveries enable row level security;
alter table public.project_delivery_domains enable row level security;
alter table public.project_delivery_corporate_emails enable row level security;
alter table public.project_delivery_log enable row level security;
alter table public.project_delivery_notifications enable row level security;
alter table public.client_credential_access_log enable row level security;

grant select, insert, update, delete on public.project_deliveries to authenticated;
grant select, insert, update, delete on public.project_delivery_domains to authenticated;
grant select, insert, update, delete on public.project_delivery_corporate_emails to authenticated;
grant select, insert, update on public.project_delivery_log to authenticated;
grant select, insert, update on public.project_delivery_notifications to authenticated;
grant select, insert on public.client_credential_access_log to authenticated;
grant all on public.project_deliveries to service_role;
grant all on public.project_delivery_domains to service_role;
grant all on public.project_delivery_corporate_emails to service_role;
grant all on public.project_delivery_log to service_role;
grant all on public.project_delivery_notifications to service_role;
grant all on public.client_credential_access_log to service_role;

create policy "project_deliveries_team"
  on public.project_deliveries for all to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.can_view_deal(deal_id)
  )
  with check (
    org_id = public.current_user_org_id()
    and public.can_view_deal(deal_id)
    and public.current_member_has_capability('crm.pipeline.edit')
  );

create policy "project_delivery_domains_team"
  on public.project_delivery_domains for all to authenticated
  using (org_id = public.current_user_org_id() and public.can_view_deal(deal_id))
  with check (org_id = public.current_user_org_id() and public.can_view_deal(deal_id));

create policy "project_delivery_corporate_emails_team"
  on public.project_delivery_corporate_emails for all to authenticated
  using (org_id = public.current_user_org_id() and public.can_view_deal(deal_id))
  with check (org_id = public.current_user_org_id() and public.can_view_deal(deal_id));

create policy "project_delivery_log_team_select"
  on public.project_delivery_log for select to authenticated
  using (org_id = public.current_user_org_id() and public.can_view_deal(deal_id));

create policy "project_delivery_notifications_team"
  on public.project_delivery_notifications for select to authenticated
  using (org_id = public.current_user_org_id() and public.can_view_deal(deal_id));

create policy "client_credential_access_log_team"
  on public.client_credential_access_log for select to authenticated
  using (org_id = public.current_user_org_id() and public.can_view_deal(deal_id));
