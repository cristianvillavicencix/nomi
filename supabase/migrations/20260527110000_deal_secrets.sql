-- Separate table for non-login secrets (API keys, tokens, Edge function keys, etc.)
-- Uses the same pgcrypto approach as deal_access_entries passwords.

create table if not exists public.deal_secrets (
  id bigserial primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  deal_id bigint not null references public.deals (id) on delete cascade,
  label text not null,
  secret_label text,
  notes text,
  has_secret boolean not null default false,
  secret_encrypted text,
  organization_member_id bigint references public.organization_members (id) on delete set null,
  created_by_member_id bigint references public.organization_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deal_secrets_deal_id_idx on public.deal_secrets (deal_id);
create index if not exists deal_secrets_org_id_idx on public.deal_secrets (org_id);

alter table public.deal_secrets enable row level security;

grant select, insert, update, delete on public.deal_secrets to authenticated;
grant all on public.deal_secrets to service_role;

create policy "Deal secrets org scoped" on public.deal_secrets
  for all to authenticated
  using (org_id = public.current_user_org_id())
  with check (org_id = public.current_user_org_id());

drop trigger if exists trg_assign_org_id_deal_secrets on public.deal_secrets;
create trigger trg_assign_org_id_deal_secrets
  before insert on public.deal_secrets
  for each row execute function public.trg_assign_org_id_from_session();

-- Audit log (separate from deal_access_entry_audit)
create table if not exists public.deal_secret_audit (
  id bigserial primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  secret_id bigint not null references public.deal_secrets (id) on delete cascade,
  deal_id bigint not null references public.deals (id) on delete cascade,
  member_id bigint references public.organization_members (id) on delete set null,
  action text not null check (action in ('viewed', 'copied', 'updated', 'created', 'deleted')),
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists deal_secret_audit_secret_id_idx on public.deal_secret_audit (secret_id, created_at desc);
create index if not exists deal_secret_audit_deal_id_idx on public.deal_secret_audit (deal_id, created_at desc);

alter table public.deal_secret_audit enable row level security;

grant select, insert on public.deal_secret_audit to authenticated;
grant all on public.deal_secret_audit to service_role;

create policy "Deal secret audit org scoped" on public.deal_secret_audit
  for all to authenticated
  using (org_id = public.current_user_org_id())
  with check (org_id = public.current_user_org_id());

-- Encryption helpers (re-use encrypt/decrypt from deal_access_entries migration).
-- Add RPC for secrets to avoid touching plaintext columns.

create or replace function public.get_deal_secret_value(p_secret_id bigint, p_key text)
returns text
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  enc text;
begin
  select secret_encrypted
  into enc
  from public.deal_secrets
  where id = p_secret_id;

  if enc is null or btrim(enc) = '' then
    return null;
  end if;

  return public.decrypt_access_entry_password(enc, p_key);
end;
$$;

create or replace function public.set_deal_secret_value(p_secret_id bigint, p_value text, p_key text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_value is null or btrim(p_value) = '' then
    update public.deal_secrets
    set
      secret_encrypted = null,
      has_secret = false,
      updated_at = now()
    where id = p_secret_id;
    return;
  end if;

  update public.deal_secrets
  set
    secret_encrypted = public.encrypt_access_entry_password(p_value, p_key),
    has_secret = true,
    updated_at = now()
  where id = p_secret_id;
end;
$$;

revoke all on function public.get_deal_secret_value(bigint, text) from public, authenticated;
revoke all on function public.set_deal_secret_value(bigint, text, text) from public, authenticated;
grant execute on function public.get_deal_secret_value(bigint, text) to service_role;
grant execute on function public.set_deal_secret_value(bigint, text, text) to service_role;

revoke select (secret_encrypted) on public.deal_secrets from authenticated;

-- Migrate existing API-key rows from deal_access_entries into deal_secrets (no decrypt needed).
insert into public.deal_secrets (
  org_id,
  deal_id,
  label,
  secret_label,
  notes,
  has_secret,
  secret_encrypted,
  organization_member_id,
  created_by_member_id,
  created_at,
  updated_at
)
select
  org_id,
  deal_id,
  label,
  coalesce(secret_label, 'API key'),
  notes,
  has_password,
  password_encrypted,
  organization_member_id,
  created_by_member_id,
  coalesce(created_at, now()),
  coalesce(updated_at, now())
from public.deal_access_entries
where kind = 'api_key';

delete from public.deal_access_entries
where kind = 'api_key';

