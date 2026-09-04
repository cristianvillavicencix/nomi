-- Internal ops vault: hosting, domains, env vars (encrypted values).

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- deal_hosting (1:1 per deal)
-- ---------------------------------------------------------------------------
create table if not exists public.deal_hosting (
  id bigserial primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  deal_id bigint not null references public.deals (id) on delete cascade,
  provider text,
  panel_url text,
  location text,
  plan_name text,
  started_at date,
  renewal_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deal_hosting_deal_id_unique unique (deal_id)
);

create index if not exists deal_hosting_org_id_idx on public.deal_hosting (org_id);

alter table public.deal_hosting enable row level security;

grant select, insert, update, delete on public.deal_hosting to authenticated;
grant all on public.deal_hosting to service_role;
grant usage, select on sequence public.deal_hosting_id_seq to authenticated, service_role;

drop trigger if exists trg_assign_org_id_deal_hosting on public.deal_hosting;
create trigger trg_assign_org_id_deal_hosting
  before insert on public.deal_hosting
  for each row execute function public.trg_assign_org_id_from_session();

drop policy if exists deal_hosting_select_scoped on public.deal_hosting;
create policy deal_hosting_select_scoped on public.deal_hosting
  for select to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('deal_operations.credentials.view')
    and public.can_view_deal(deal_id)
  );

drop policy if exists deal_hosting_insert_scoped on public.deal_hosting;
create policy deal_hosting_insert_scoped on public.deal_hosting
  for insert to authenticated
  with check (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('deal_operations.credentials.manage')
    and public.can_view_deal(deal_id)
  );

drop policy if exists deal_hosting_update_scoped on public.deal_hosting;
create policy deal_hosting_update_scoped on public.deal_hosting
  for update to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('deal_operations.credentials.manage')
    and public.can_view_deal(deal_id)
  )
  with check (
    org_id = public.current_user_org_id()
    and public.can_view_deal(deal_id)
  );

drop policy if exists deal_hosting_delete_scoped on public.deal_hosting;
create policy deal_hosting_delete_scoped on public.deal_hosting
  for delete to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('deal_operations.credentials.manage')
    and public.can_view_deal(deal_id)
  );

-- ---------------------------------------------------------------------------
-- deal_domains (1:N)
-- ---------------------------------------------------------------------------
create table if not exists public.deal_domains (
  id bigserial primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  deal_id bigint not null references public.deals (id) on delete cascade,
  domain text not null,
  registrar text,
  dns_notes text,
  registered_at date,
  renewal_at date,
  https_notes text,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deal_domains_deal_id_idx on public.deal_domains (deal_id);
create index if not exists deal_domains_org_id_idx on public.deal_domains (org_id);

alter table public.deal_domains enable row level security;

grant select, insert, update, delete on public.deal_domains to authenticated;
grant all on public.deal_domains to service_role;
grant usage, select on sequence public.deal_domains_id_seq to authenticated, service_role;

drop trigger if exists trg_assign_org_id_deal_domains on public.deal_domains;
create trigger trg_assign_org_id_deal_domains
  before insert on public.deal_domains
  for each row execute function public.trg_assign_org_id_from_session();

drop policy if exists deal_domains_select_scoped on public.deal_domains;
create policy deal_domains_select_scoped on public.deal_domains
  for select to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('deal_operations.credentials.view')
    and public.can_view_deal(deal_id)
  );

drop policy if exists deal_domains_insert_scoped on public.deal_domains;
create policy deal_domains_insert_scoped on public.deal_domains
  for insert to authenticated
  with check (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('deal_operations.credentials.manage')
    and public.can_view_deal(deal_id)
  );

drop policy if exists deal_domains_update_scoped on public.deal_domains;
create policy deal_domains_update_scoped on public.deal_domains
  for update to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('deal_operations.credentials.manage')
    and public.can_view_deal(deal_id)
  )
  with check (
    org_id = public.current_user_org_id()
    and public.can_view_deal(deal_id)
  );

drop policy if exists deal_domains_delete_scoped on public.deal_domains;
create policy deal_domains_delete_scoped on public.deal_domains
  for delete to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('deal_operations.credentials.manage')
    and public.can_view_deal(deal_id)
  );

-- ---------------------------------------------------------------------------
-- deal_env_vars (1:N, encrypted values)
-- ---------------------------------------------------------------------------
create table if not exists public.deal_env_vars (
  id bigserial primary key,
  org_id bigint not null references public.organizations (id) on delete cascade,
  deal_id bigint not null references public.deals (id) on delete cascade,
  key text not null,
  value_encrypted text,
  has_value boolean not null default false,
  is_secret boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deal_env_vars_deal_key_unique unique (deal_id, key)
);

create index if not exists deal_env_vars_deal_id_idx on public.deal_env_vars (deal_id);
create index if not exists deal_env_vars_org_id_idx on public.deal_env_vars (org_id);

alter table public.deal_env_vars enable row level security;

grant select, insert, update, delete on public.deal_env_vars to authenticated;
grant all on public.deal_env_vars to service_role;
grant usage, select on sequence public.deal_env_vars_id_seq to authenticated, service_role;

drop trigger if exists trg_assign_org_id_deal_env_vars on public.deal_env_vars;
create trigger trg_assign_org_id_deal_env_vars
  before insert on public.deal_env_vars
  for each row execute function public.trg_assign_org_id_from_session();

drop policy if exists deal_env_vars_select_scoped on public.deal_env_vars;
create policy deal_env_vars_select_scoped on public.deal_env_vars
  for select to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('deal_operations.credentials.view')
    and public.can_view_deal(deal_id)
  );

drop policy if exists deal_env_vars_insert_scoped on public.deal_env_vars;
create policy deal_env_vars_insert_scoped on public.deal_env_vars
  for insert to authenticated
  with check (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('deal_operations.credentials.manage')
    and public.can_view_deal(deal_id)
  );

drop policy if exists deal_env_vars_update_scoped on public.deal_env_vars;
create policy deal_env_vars_update_scoped on public.deal_env_vars
  for update to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('deal_operations.credentials.manage')
    and public.can_view_deal(deal_id)
  )
  with check (
    org_id = public.current_user_org_id()
    and public.can_view_deal(deal_id)
  );

drop policy if exists deal_env_vars_delete_scoped on public.deal_env_vars;
create policy deal_env_vars_delete_scoped on public.deal_env_vars
  for delete to authenticated
  using (
    org_id = public.current_user_org_id()
    and public.current_member_has_capability('deal_operations.credentials.manage')
    and public.can_view_deal(deal_id)
  );

revoke select (value_encrypted) on public.deal_env_vars from authenticated;

-- Reuse encrypt/decrypt helpers from access entry passwords.
create or replace function public.get_deal_env_var_value(p_var_id bigint, p_key text)
returns text
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  enc text;
begin
  select value_encrypted
  into enc
  from public.deal_env_vars
  where id = p_var_id;

  if enc is null or btrim(enc) = '' then
    return null;
  end if;

  return public.decrypt_access_entry_password(enc, p_key);
end;
$$;

create or replace function public.set_deal_env_var_value(
  p_var_id bigint,
  p_value text,
  p_key text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_value is null or btrim(p_value) = '' then
    update public.deal_env_vars
    set
      value_encrypted = null,
      has_value = false,
      updated_at = now()
    where id = p_var_id;
    return;
  end if;

  update public.deal_env_vars
  set
    value_encrypted = public.encrypt_access_entry_password(p_value, p_key),
    has_value = true,
    updated_at = now()
  where id = p_var_id;
end;
$$;

create or replace function public.upsert_deal_env_var(
  p_deal_id bigint,
  p_org_id bigint,
  p_env_key text,
  p_value text,
  p_is_secret boolean,
  p_sort_order integer,
  p_crypto_key text
)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  var_id bigint;
  trimmed_key text := btrim(p_env_key);
begin
  if trimmed_key = '' then
    raise exception 'env key is required';
  end if;

  insert into public.deal_env_vars (
    org_id,
    deal_id,
    key,
    is_secret,
    sort_order,
    has_value,
    value_encrypted
  )
  values (
    p_org_id,
    p_deal_id,
    trimmed_key,
    coalesce(p_is_secret, true),
    coalesce(p_sort_order, 0),
    case when p_value is null or btrim(p_value) = '' then false else true end,
    case
      when p_value is null or btrim(p_value) = '' then null
      else public.encrypt_access_entry_password(p_value, p_crypto_key)
    end
  )
  on conflict (deal_id, key) do update
  set
    is_secret = excluded.is_secret,
    sort_order = excluded.sort_order,
    has_value = excluded.has_value,
    value_encrypted = case
      when p_value is null then deal_env_vars.value_encrypted
      when btrim(p_value) = '' then null
      else excluded.value_encrypted
    end,
    updated_at = now()
  returning id into var_id;

  return var_id;
end;
$$;

revoke all on function public.get_deal_env_var_value(bigint, text) from public, authenticated;
revoke all on function public.set_deal_env_var_value(bigint, text, text) from public, authenticated;
revoke all on function public.upsert_deal_env_var(bigint, bigint, text, text, boolean, integer, text) from public, authenticated;

grant execute on function public.get_deal_env_var_value(bigint, text) to service_role;
grant execute on function public.set_deal_env_var_value(bigint, text, text) to service_role;
grant execute on function public.upsert_deal_env_var(bigint, bigint, text, text, boolean, integer, text) to service_role;
