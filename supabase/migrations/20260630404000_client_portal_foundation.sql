-- Client portal foundation + approval requests.

create table if not exists public.client_portal_accounts (
  id bigint generated always as identity primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  contact_id bigint not null references public.contacts (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  email text not null,
  invitation_token text unique,
  invitation_sent_at timestamptz,
  invitation_accepted_at timestamptz,
  last_login_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.client_portal_deal_access (
  id bigint generated always as identity primary key,
  portal_account_id bigint not null references public.client_portal_accounts (id) on delete cascade,
  deal_id bigint not null references public.deals (id) on delete cascade,
  org_id bigint not null references public.organizations (id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by_member_id bigint references public.organization_members (id) on delete set null,
  unique (portal_account_id, deal_id)
);

create table if not exists public.deal_approvals (
  id bigint generated always as identity primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  deal_id bigint not null references public.deals (id) on delete cascade,
  resource_type text not null check (
    resource_type in ('mockup', 'copy', 'content', 'design', 'contract', 'proposal', 'other')
  ),
  resource_url text,
  title text not null,
  description text,
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'rejected', 'revision_requested')
  ),
  requested_by_member_id bigint references public.organization_members (id) on delete set null,
  responded_at timestamptz,
  response_comment text,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists client_portal_accounts_org_email_idx
  on public.client_portal_accounts (org_id, email);
create index if not exists client_portal_deal_access_deal_idx
  on public.client_portal_deal_access (deal_id);
create index if not exists deal_approvals_deal_idx
  on public.deal_approvals (deal_id, status);

alter table public.client_portal_accounts enable row level security;
alter table public.client_portal_deal_access enable row level security;
alter table public.deal_approvals enable row level security;

grant select, insert, update, delete on public.client_portal_accounts to authenticated;
grant select, insert, update, delete on public.client_portal_deal_access to authenticated;
grant select, insert, update, delete on public.deal_approvals to authenticated;

create policy "client_portal_accounts_team"
  on public.client_portal_accounts for all to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('crm.pipeline.edit')
  )
  with check (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('crm.pipeline.edit')
  );

create policy "client_portal_deal_access_team"
  on public.client_portal_deal_access for all to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.can_view_deal(deal_id)
  )
  with check (
    org_id = public.current_user_org_id()
    and public.can_view_deal(deal_id)
  );

create policy "deal_approvals_select"
  on public.deal_approvals for select to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.can_view_deal(deal_id)
  );

create policy "deal_approvals_mutate"
  on public.deal_approvals for all to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.can_view_deal(deal_id)
    and public.current_member_has_capability('crm.pipeline.edit')
  )
  with check (
    org_id = public.current_user_org_id()
    and public.can_view_deal(deal_id)
  );
