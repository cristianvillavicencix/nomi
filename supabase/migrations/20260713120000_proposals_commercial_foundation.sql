-- Proposals & contracts commercial foundation: service catalog, payment schedules, contract terms.

-- ---------------------------------------------------------------------------
-- Organizations: client billing mode (manual vs stripe)
-- ---------------------------------------------------------------------------
alter table public.organizations
  add column if not exists client_billing_mode text not null default 'manual'
    check (client_billing_mode in ('manual', 'stripe'));

comment on column public.organizations.client_billing_mode is
  'How client-facing proposal/contract payments are collected. manual = mark paid in CRM; stripe = Stripe charges (when configured).';

-- ---------------------------------------------------------------------------
-- Service catalog
-- ---------------------------------------------------------------------------
create table if not exists public.service_packages (
  id bigserial primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  name text not null,
  description text,
  suggested_price numeric(12, 2) not null default 0,
  billing_type text not null default 'one_time'
    check (billing_type in ('one_time', 'recurring')),
  billing_interval text
    check (
      billing_interval is null
      or billing_interval in ('weekly', 'monthly', 'yearly')
    ),
  category text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_packages_recurring_interval check (
    billing_type = 'one_time'
    or billing_interval is not null
  )
);

create table if not exists public.service_addons (
  id bigserial primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  package_id bigint references public.service_packages (id) on delete set null,
  name text not null,
  description text,
  suggested_price numeric(12, 2) not null default 0,
  billing_type text not null default 'one_time'
    check (billing_type in ('one_time', 'recurring')),
  billing_interval text
    check (
      billing_interval is null
      or billing_interval in ('weekly', 'monthly', 'yearly')
    ),
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_addons_recurring_interval check (
    billing_type = 'one_time'
    or billing_interval is not null
  )
);

create index if not exists service_packages_org_idx
  on public.service_packages (org_id, active, sort_order);
create index if not exists service_addons_org_idx
  on public.service_addons (org_id, active, sort_order);

-- ---------------------------------------------------------------------------
-- Versioned contract terms per organization
-- ---------------------------------------------------------------------------
create table if not exists public.organization_contract_terms (
  id bigserial primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  version text not null,
  title text not null default 'Service Terms and Conditions',
  body_markdown text not null,
  default_variables jsonb not null default '{}'::jsonb,
  is_active boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, version)
);

create unique index if not exists organization_contract_terms_one_active_idx
  on public.organization_contract_terms (org_id)
  where is_active = true;

-- ---------------------------------------------------------------------------
-- Extend proposals
-- ---------------------------------------------------------------------------
alter table public.proposals
  add column if not exists proposal_number text,
  add column if not exists validity_days int not null default 30,
  add column if not exists deposit_percent numeric(5, 2) not null default 50,
  add column if not exists deposit_amount numeric(12, 2),
  add column if not exists balance_amount numeric(12, 2),
  add column if not exists currency text not null default 'USD',
  add column if not exists one_time_total numeric(12, 2),
  add column if not exists payment_schedule_config jsonb not null default '{}'::jsonb,
  add column if not exists recurring_summary jsonb not null default '[]'::jsonb;

create unique index if not exists proposals_org_proposal_number_idx
  on public.proposals (org_id, proposal_number)
  where proposal_number is not null;

-- ---------------------------------------------------------------------------
-- Extend proposal line items
-- ---------------------------------------------------------------------------
alter table public.proposal_line_items
  add column if not exists package_id bigint references public.service_packages (id) on delete set null,
  add column if not exists addon_id bigint references public.service_addons (id) on delete set null,
  add column if not exists billing_type text not null default 'one_time'
    check (billing_type in ('one_time', 'recurring')),
  add column if not exists billing_interval text
    check (
      billing_interval is null
      or billing_interval in ('weekly', 'monthly', 'yearly')
    ),
  add column if not exists line_total numeric(12, 2);

-- ---------------------------------------------------------------------------
-- Payment schedules
-- ---------------------------------------------------------------------------
create table if not exists public.proposal_payment_schedules (
  id bigserial primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  proposal_id bigint not null references public.proposals (id) on delete cascade,
  contract_id bigint references public.contracts (id) on delete set null,
  deposit_amount numeric(12, 2) not null default 0,
  balance_amount numeric(12, 2) not null default 0,
  deposit_due_date date,
  installment_frequency text not null default 'weekly'
    check (
      installment_frequency in ('weekly', 'biweekly', 'monthly', 'custom')
    ),
  installment_count int not null default 1,
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proposal_id)
);

create table if not exists public.proposal_payment_installments (
  id bigserial primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  schedule_id bigint not null references public.proposal_payment_schedules (id) on delete cascade,
  proposal_id bigint not null references public.proposals (id) on delete cascade,
  installment_number int not null,
  label text not null,
  due_date date not null,
  amount numeric(12, 2) not null default 0,
  billing_type text not null default 'one_time'
    check (billing_type in ('one_time', 'recurring')),
  status text not null default 'pending'
    check (
      status in ('pending', 'paid', 'failed', 'skipped', 'waived')
    ),
  paid_at timestamptz,
  payment_method text not null default 'manual'
    check (payment_method in ('manual', 'stripe', 'check', 'zelle', 'ach', 'card', 'other')),
  stripe_payment_intent_id text,
  stripe_invoice_id text,
  stripe_subscription_id text,
  manual_marked_by_member_id bigint references public.organization_members (id) on delete set null,
  manual_marked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists proposal_payment_installments_proposal_idx
  on public.proposal_payment_installments (proposal_id, installment_number);
create index if not exists proposal_payment_installments_schedule_idx
  on public.proposal_payment_installments (schedule_id, due_date);

-- ---------------------------------------------------------------------------
-- Extend contracts
-- ---------------------------------------------------------------------------
alter table public.contracts
  add column if not exists terms_version text,
  add column if not exists terms_snapshot text,
  add column if not exists signed_ip text,
  add column if not exists signed_by_contact_id bigint references public.contacts (id) on delete set null,
  add column if not exists deposit_paid_at timestamptz,
  add column if not exists payment_schedule_id bigint references public.proposal_payment_schedules (id) on delete set null,
  add column if not exists stripe_customer_id text;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.service_packages enable row level security;
alter table public.service_addons enable row level security;
alter table public.organization_contract_terms enable row level security;
alter table public.proposal_payment_schedules enable row level security;
alter table public.proposal_payment_installments enable row level security;

grant select, insert, update, delete on public.service_packages to authenticated;
grant select, insert, update, delete on public.service_addons to authenticated;
grant select, insert, update, delete on public.organization_contract_terms to authenticated;
grant select, insert, update, delete on public.proposal_payment_schedules to authenticated;
grant select, insert, update, delete on public.proposal_payment_installments to authenticated;

grant all on public.service_packages to service_role;
grant all on public.service_addons to service_role;
grant all on public.organization_contract_terms to service_role;
grant all on public.proposal_payment_schedules to service_role;
grant all on public.proposal_payment_installments to service_role;

create policy "service_packages_org_scoped"
  on public.service_packages for all to authenticated
  using (org_id = public.current_user_org_id())
  with check (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('proposals.edit')
  );

create policy "service_addons_org_scoped"
  on public.service_addons for all to authenticated
  using (org_id = public.current_user_org_id())
  with check (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('proposals.edit')
  );

create policy "organization_contract_terms_org_scoped"
  on public.organization_contract_terms for all to authenticated
  using (org_id = public.current_user_org_id())
  with check (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('contracts.edit')
  );

create policy "proposal_payment_schedules_org_scoped"
  on public.proposal_payment_schedules for all to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('proposals.view')
  )
  with check (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('proposals.edit')
  );

create policy "proposal_payment_installments_org_scoped"
  on public.proposal_payment_installments for all to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('proposals.view')
  )
  with check (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('proposals.edit')
  );

drop trigger if exists trg_assign_org_id_service_packages on public.service_packages;
create trigger trg_assign_org_id_service_packages
  before insert on public.service_packages
  for each row execute function public.trg_assign_org_id_from_session();

drop trigger if exists trg_assign_org_id_service_addons on public.service_addons;
create trigger trg_assign_org_id_service_addons
  before insert on public.service_addons
  for each row execute function public.trg_assign_org_id_from_session();

drop trigger if exists trg_assign_org_id_organization_contract_terms on public.organization_contract_terms;
create trigger trg_assign_org_id_organization_contract_terms
  before insert on public.organization_contract_terms
  for each row execute function public.trg_assign_org_id_from_session();

drop trigger if exists trg_assign_org_id_proposal_payment_schedules on public.proposal_payment_schedules;
create trigger trg_assign_org_id_proposal_payment_schedules
  before insert on public.proposal_payment_schedules
  for each row execute function public.trg_assign_org_id_from_session();

drop trigger if exists trg_assign_org_id_proposal_payment_installments on public.proposal_payment_installments;
create trigger trg_assign_org_id_proposal_payment_installments
  before insert on public.proposal_payment_installments
  for each row execute function public.trg_assign_org_id_from_session();
