-- LBS CRM modules: lead fields, website brief, proposals, contracts, forms, tickets

alter table public.contacts
  add column if not exists lead_source text,
  add column if not exists interested_service text;

alter table public.deals
  add column if not exists website_brief jsonb default '{}'::jsonb;

alter table public.tasks
  add column if not exists deal_id bigint references public.deals (id) on delete set null;

create index if not exists tasks_deal_id_idx on public.tasks (deal_id);

drop view if exists public.contacts_summary;

create view public.contacts_summary
with (security_invoker = true)
as
select
  co.id,
  co.first_name,
  co.last_name,
  co.gender,
  co.title,
  co.email_jsonb,
  jsonb_path_query_array(co.email_jsonb, '$[*].email')::text as email_fts,
  co.phone_jsonb,
  jsonb_path_query_array(co.phone_jsonb, '$[*].number')::text as phone_fts,
  co.background,
  co.address,
  co.avatar,
  co.first_seen,
  co.last_seen,
  co.has_newsletter,
  co.status,
  co.tags,
  co.company_id,
  co.organization_member_id,
  co.linkedin_url,
  co.lead_source,
  co.interested_service,
  c.name as company_name,
  count(distinct t.id) as nb_tasks
from public.contacts co
left join public.tasks t on co.id = t.contact_id
left join public.companies c on co.company_id = c.id
group by co.id, c.name;

grant select on public.contacts_summary to authenticated;
grant select on public.contacts_summary to service_role;

create table if not exists public.proposals (
  id bigserial primary key,
  org_id bigint not null references public.organizations (id),
  company_id bigint references public.companies (id) on delete set null,
  contact_id bigint references public.contacts (id) on delete set null,
  deal_id bigint references public.deals (id) on delete set null,
  organization_member_id bigint references public.organization_members (id) on delete set null,
  title text not null,
  status text not null default 'draft',
  amount numeric(12, 2) default 0,
  valid_until date,
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  content jsonb default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.proposal_line_items (
  id bigserial primary key,
  proposal_id bigint not null references public.proposals (id) on delete cascade,
  description text not null,
  quantity numeric(10, 2) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  sort_order int not null default 0
);

create table if not exists public.contracts (
  id bigserial primary key,
  org_id bigint not null references public.organizations (id),
  company_id bigint references public.companies (id) on delete set null,
  contact_id bigint references public.contacts (id) on delete set null,
  proposal_id bigint references public.proposals (id) on delete set null,
  deal_id bigint references public.deals (id) on delete set null,
  organization_member_id bigint references public.organization_members (id) on delete set null,
  title text not null,
  status text not null default 'draft',
  signed_at timestamptz,
  expires_at date,
  document jsonb default '{}'::jsonb,
  file jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.forms (
  id bigserial primary key,
  org_id bigint not null references public.organizations (id),
  name text not null,
  slug text not null,
  description text,
  schema jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, slug)
);

create table if not exists public.form_submissions (
  id bigserial primary key,
  org_id bigint not null references public.organizations (id),
  form_id bigint not null references public.forms (id) on delete cascade,
  company_id bigint references public.companies (id) on delete set null,
  contact_id bigint references public.contacts (id) on delete set null,
  deal_id bigint references public.deals (id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.tickets (
  id bigserial primary key,
  org_id bigint not null references public.organizations (id),
  company_id bigint references public.companies (id) on delete set null,
  contact_id bigint references public.contacts (id) on delete set null,
  deal_id bigint references public.deals (id) on delete set null,
  assignee_id bigint references public.organization_members (id) on delete set null,
  organization_member_id bigint references public.organization_members (id) on delete set null,
  subject text not null,
  status text not null default 'open',
  priority text not null default 'normal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ticket_messages (
  id bigserial primary key,
  ticket_id bigint not null references public.tickets (id) on delete cascade,
  author_member_id bigint references public.organization_members (id) on delete set null,
  body text not null,
  attachments jsonb[] default '{}',
  created_at timestamptz not null default now()
);

create index if not exists proposals_org_id_idx on public.proposals (org_id);
create index if not exists proposals_deal_id_idx on public.proposals (deal_id);
create index if not exists contracts_org_id_idx on public.contracts (org_id);
create index if not exists contracts_deal_id_idx on public.contracts (deal_id);
create index if not exists forms_org_id_idx on public.forms (org_id);
create index if not exists form_submissions_form_id_idx on public.form_submissions (form_id);
create index if not exists tickets_org_id_idx on public.tickets (org_id);
create index if not exists tickets_deal_id_idx on public.tickets (deal_id);
create index if not exists ticket_messages_ticket_id_idx on public.ticket_messages (ticket_id);

alter table public.proposals enable row level security;
alter table public.proposal_line_items enable row level security;
alter table public.contracts enable row level security;
alter table public.forms enable row level security;
alter table public.form_submissions enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;

grant select, insert, update, delete on public.proposals to authenticated;
grant select, insert, update, delete on public.proposal_line_items to authenticated;
grant select, insert, update, delete on public.contracts to authenticated;
grant select, insert, update, delete on public.forms to authenticated;
grant select, insert, update, delete on public.form_submissions to authenticated;
grant select, insert, update, delete on public.tickets to authenticated;
grant select, insert, update, delete on public.ticket_messages to authenticated;

grant all on public.proposals to service_role;
grant all on public.proposal_line_items to service_role;
grant all on public.contracts to service_role;
grant all on public.forms to service_role;
grant all on public.form_submissions to service_role;
grant all on public.tickets to service_role;
grant all on public.ticket_messages to service_role;

create policy "Proposals org scoped" on public.proposals
  for all to authenticated
  using (org_id = public.current_user_org_id())
  with check (org_id = public.current_user_org_id());

create policy "Proposal line items via proposal" on public.proposal_line_items
  for all to authenticated
  using (
    exists (
      select 1 from public.proposals p
      where p.id = proposal_line_items.proposal_id
        and p.org_id = public.current_user_org_id()
    )
  )
  with check (
    exists (
      select 1 from public.proposals p
      where p.id = proposal_line_items.proposal_id
        and p.org_id = public.current_user_org_id()
    )
  );

create policy "Contracts org scoped" on public.contracts
  for all to authenticated
  using (org_id = public.current_user_org_id())
  with check (org_id = public.current_user_org_id());

create policy "Forms org scoped" on public.forms
  for all to authenticated
  using (org_id = public.current_user_org_id())
  with check (org_id = public.current_user_org_id());

create policy "Form submissions org scoped" on public.form_submissions
  for all to authenticated
  using (org_id = public.current_user_org_id())
  with check (org_id = public.current_user_org_id());

create policy "Tickets org scoped" on public.tickets
  for all to authenticated
  using (org_id = public.current_user_org_id())
  with check (org_id = public.current_user_org_id());

create policy "Ticket messages via ticket" on public.ticket_messages
  for all to authenticated
  using (
    exists (
      select 1 from public.tickets t
      where t.id = ticket_messages.ticket_id
        and t.org_id = public.current_user_org_id()
    )
  )
  with check (
    exists (
      select 1 from public.tickets t
      where t.id = ticket_messages.ticket_id
        and t.org_id = public.current_user_org_id()
    )
  );

-- Seed before org triggers (migrations run without an authenticated session).
insert into public.forms (org_id, name, slug, description, schema, active)
select
  o.id,
  'Website Intake Form',
  'website-intake',
  'Collect website project requirements from clients.',
  jsonb_build_object(
    'fields', jsonb_build_array(
      'logo', 'brand_colors', 'images', 'copy', 'services',
      'domain', 'hosting', 'access_credentials', 'social_links',
      'google_business_profile', 'client_notes'
    )
  ),
  true
from public.organizations o
where not exists (
  select 1 from public.forms f
  where f.slug = 'website-intake' and f.org_id = o.id
);

drop trigger if exists trg_assign_org_id_proposals on public.proposals;
create trigger trg_assign_org_id_proposals
  before insert on public.proposals
  for each row execute function public.trg_assign_org_id_from_session();

drop trigger if exists trg_assign_org_id_contracts on public.contracts;
create trigger trg_assign_org_id_contracts
  before insert on public.contracts
  for each row execute function public.trg_assign_org_id_from_session();

drop trigger if exists trg_assign_org_id_forms on public.forms;
create trigger trg_assign_org_id_forms
  before insert on public.forms
  for each row execute function public.trg_assign_org_id_from_session();

drop trigger if exists trg_assign_org_id_form_submissions on public.form_submissions;
create trigger trg_assign_org_id_form_submissions
  before insert on public.form_submissions
  for each row execute function public.trg_assign_org_id_from_session();

drop trigger if exists trg_assign_org_id_tickets on public.tickets;
create trigger trg_assign_org_id_tickets
  before insert on public.tickets
  for each row execute function public.trg_assign_org_id_from_session();
