-- Reusable proposal document templates (editable section copy per organization).

create table if not exists public.proposal_templates (
  id bigserial primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  name text not null,
  slug text not null,
  category text,
  content jsonb not null default '{}'::jsonb,
  is_system boolean not null default false,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, slug)
);

create index if not exists proposal_templates_org_idx
  on public.proposal_templates (org_id, active, sort_order);

alter table public.proposal_templates enable row level security;

grant select, insert, update, delete on public.proposal_templates to authenticated;
grant all on public.proposal_templates to service_role;

create policy proposal_templates_org_scoped
  on public.proposal_templates for all to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('proposals.view')
  )
  with check (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('proposals.edit')
  );

drop trigger if exists trg_assign_org_id_proposal_templates on public.proposal_templates;
create trigger trg_assign_org_id_proposal_templates
  before insert on public.proposal_templates
  for each row execute function public.trg_assign_org_id_from_session();
