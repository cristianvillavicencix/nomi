-- Forms v2: templates, instances, submissions, events, public tokens

create table public.form_templates (
  id bigint generated always as identity primary key,
  org_id bigint references public.organizations (id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  type text not null check (type in (
    'project_brief',
    'contact',
    'lead_capture',
    'quote_request',
    'nps_survey',
    'job_application',
    'generic_survey',
    'custom'
  )),
  schema jsonb not null default '{"sections":[]}'::jsonb,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, slug)
);

create table public.form_instances (
  id bigint generated always as identity primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  template_id bigint references public.form_templates (id) on delete set null,
  name text not null,
  slug text not null,
  description text,
  schema jsonb not null default '{"sections":[]}'::jsonb,
  logo_url text,
  primary_color text default '#1E5FA8',
  background_image_url text,
  welcome_title text,
  welcome_message text,
  thank_you_title text default 'Thank you!',
  thank_you_message text default 'Your submission has been received.',
  redirect_url text,
  is_active boolean not null default true,
  is_public boolean not null default true,
  notify_on_submit boolean not null default true,
  notify_member_ids bigint[] not null default '{}',
  auto_create_contact boolean not null default false,
  auto_create_lead boolean not null default false,
  auto_create_task boolean not null default false,
  expiration_date timestamptz,
  submission_limit int,
  recaptcha_enabled boolean not null default true,
  honeypot_enabled boolean not null default true,
  rate_limit_per_ip_per_hour int not null default 5,
  created_by_member_id bigint references public.organization_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, slug)
);

create table public.form_submissions_v2 (
  id bigint generated always as identity primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  form_instance_id bigint not null references public.form_instances (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  contact_id bigint references public.contacts (id) on delete set null,
  company_id bigint references public.companies (id) on delete set null,
  deal_id bigint references public.deals (id) on delete set null,
  status text not null default 'new' check (status in ('new', 'reviewed', 'contacted', 'archived', 'spam')),
  submitter_email text,
  submitter_phone text,
  submitter_name text,
  ip_address inet,
  user_agent text,
  source_url text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by_member_id bigint references public.organization_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.form_submission_events (
  id bigint generated always as identity primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  form_instance_id bigint not null references public.form_instances (id) on delete cascade,
  submission_id bigint references public.form_submissions_v2 (id) on delete set null,
  event_type text not null check (event_type in (
    'viewed',
    'started',
    'field_focused',
    'field_completed',
    'abandoned',
    'submitted',
    'spam_blocked',
    'rate_limited'
  )),
  field_key text,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create table public.public_form_tokens (
  id bigint generated always as identity primary key,
  token text not null unique,
  org_id bigint not null references public.organizations (id) on delete cascade,
  form_instance_id bigint not null references public.form_instances (id) on delete cascade,
  contact_id bigint references public.contacts (id) on delete set null,
  company_id bigint references public.companies (id) on delete set null,
  deal_id bigint references public.deals (id) on delete set null,
  expires_at timestamptz,
  max_uses int default 1,
  uses_count int not null default 0,
  created_by_member_id bigint references public.organization_members (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_form_instances_org_slug on public.form_instances (org_id, slug);
create index idx_form_submissions_v2_org_form
  on public.form_submissions_v2 (org_id, form_instance_id, submitted_at desc);
create index idx_form_submissions_v2_deal
  on public.form_submissions_v2 (deal_id) where deal_id is not null;
create index idx_form_submissions_v2_contact
  on public.form_submissions_v2 (contact_id) where contact_id is not null;
create index idx_form_submission_events_form
  on public.form_submission_events (form_instance_id, created_at desc);
create index idx_public_form_tokens_token on public.public_form_tokens (token);

alter table public.form_templates enable row level security;
alter table public.form_instances enable row level security;
alter table public.form_submissions_v2 enable row level security;
alter table public.form_submission_events enable row level security;
alter table public.public_form_tokens enable row level security;

grant select, insert, update, delete on public.form_templates to authenticated;
grant select, insert, update, delete on public.form_instances to authenticated;
grant select, update, delete on public.form_submissions_v2 to authenticated;
grant select on public.form_submission_events to authenticated;
grant select, insert, delete on public.public_form_tokens to authenticated;

create policy "form_templates_select" on public.form_templates
  for select to authenticated
  using (is_system = true or org_id = public.current_user_org_id());

create policy "form_templates_insert" on public.form_templates
  for insert to authenticated
  with check (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('forms.manage')
    and is_system = false
  );

create policy "form_templates_update" on public.form_templates
  for update to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('forms.manage')
    and is_system = false
  );

create policy "form_templates_delete" on public.form_templates
  for delete to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('forms.manage')
    and is_system = false
  );

create policy "form_instances_select" on public.form_instances
  for select to authenticated
  using (org_id = public.current_user_org_id());

create policy "form_instances_insert" on public.form_instances
  for insert to authenticated
  with check (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('forms.manage')
  );

create policy "form_instances_update" on public.form_instances
  for update to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('forms.manage')
  );

create policy "form_instances_delete" on public.form_instances
  for delete to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('forms.manage')
  );

create policy "form_submissions_v2_select" on public.form_submissions_v2
  for select to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('forms.submissions.view')
  );

create policy "form_submissions_v2_update" on public.form_submissions_v2
  for update to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('forms.submissions.view')
  );

create policy "form_submissions_v2_delete" on public.form_submissions_v2
  for delete to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('forms.manage')
  );

create policy "form_submission_events_select" on public.form_submission_events
  for select to authenticated
  using (org_id = public.current_user_org_id());

create policy "public_form_tokens_select" on public.public_form_tokens
  for select to authenticated
  using (org_id = public.current_user_org_id());

create policy "public_form_tokens_insert" on public.public_form_tokens
  for insert to authenticated
  with check (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('forms.manage')
  );

create policy "public_form_tokens_delete" on public.public_form_tokens
  for delete to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('forms.manage')
  );

create or replace function public.set_form_template_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_system = false and new.org_id is null then
    new.org_id := public.current_user_org_id();
  end if;
  return new;
end;
$$;

create or replace function public.set_form_instance_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is null then
    new.org_id := public.current_user_org_id();
  end if;
  if new.created_by_member_id is null then
    new.created_by_member_id := public.current_user_member_id();
  end if;
  return new;
end;
$$;

create trigger trg_set_form_template_org_id
  before insert on public.form_templates
  for each row execute function public.set_form_template_org_id();

create trigger trg_set_form_instance_defaults
  before insert on public.form_instances
  for each row execute function public.set_form_instance_defaults();
