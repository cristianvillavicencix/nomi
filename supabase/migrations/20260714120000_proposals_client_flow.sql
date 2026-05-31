-- Public proposal links, contract signing metadata, submission → proposal link.

create table if not exists public.public_proposal_tokens (
  id bigint generated always as identity primary key,
  token text not null unique,
  short_code text unique,
  org_id bigint not null references public.organizations (id) on delete cascade,
  proposal_id bigint not null references public.proposals (id) on delete cascade,
  expires_at timestamptz,
  max_uses int,
  uses_count int not null default 0,
  created_by_member_id bigint references public.organization_members (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists public_proposal_tokens_proposal_idx
  on public.public_proposal_tokens (proposal_id, created_at desc);
create index if not exists public_proposal_tokens_token_idx
  on public.public_proposal_tokens (token);
create index if not exists public_proposal_tokens_short_code_idx
  on public.public_proposal_tokens (short_code)
  where short_code is not null;

alter table public.proposals
  add column if not exists contract_id bigint references public.contracts (id) on delete set null;

alter table public.contracts
  add column if not exists signatory_name text;

alter table public.form_submissions_v2
  add column if not exists proposal_id bigint references public.proposals (id) on delete set null;

alter table public.public_proposal_tokens enable row level security;

grant select, insert, update on public.public_proposal_tokens to authenticated;
grant select, insert, update, delete on public.public_proposal_tokens to service_role;

create policy "public_proposal_tokens_select"
  on public.public_proposal_tokens for select to authenticated
  using (org_id = public.current_user_org_id());

create policy "public_proposal_tokens_insert"
  on public.public_proposal_tokens for insert to authenticated
  with check (org_id = public.current_user_org_id());

create policy "public_proposal_tokens_update"
  on public.public_proposal_tokens for update to authenticated
  using (org_id = public.current_user_org_id())
  with check (org_id = public.current_user_org_id());

comment on table public.public_proposal_tokens is
  'Signed URLs for client-facing proposal view, accept, and contract signing.';
