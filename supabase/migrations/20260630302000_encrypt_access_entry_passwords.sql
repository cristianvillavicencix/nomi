-- Encrypt deal access entry passwords at rest (pgcrypto). Edge functions pass PGCRYPTO_KEY.

create extension if not exists pgcrypto with schema extensions;

alter table public.deal_access_entries
  add column if not exists password_encrypted text;

alter table public.deal_access_entries
  add column if not exists has_password boolean not null default false;

comment on column public.deal_access_entries.password_encrypted is
  'pgcrypto-encrypted password (base64). Plain password column is cleared after migration.';

create or replace function public.encrypt_access_entry_password(p_password text, p_key text)
returns text
language plpgsql
immutable
set search_path = public, extensions
as $$
begin
  if p_password is null or btrim(p_password) = '' then
    return null;
  end if;
  if p_key is null or btrim(p_key) = '' then
    raise exception 'PGCRYPTO_KEY is required to encrypt access entry password';
  end if;
  return encode(extensions.pgp_sym_encrypt(btrim(p_password), btrim(p_key)), 'base64');
end;
$$;

create or replace function public.decrypt_access_entry_password(p_encrypted text, p_key text)
returns text
language plpgsql
immutable
set search_path = public, extensions
as $$
begin
  if p_encrypted is null or btrim(p_encrypted) = '' then
    return null;
  end if;
  if p_key is null or btrim(p_key) = '' then
    raise exception 'PGCRYPTO_KEY is required to decrypt access entry password';
  end if;
  return extensions.pgp_sym_decrypt(decode(btrim(p_encrypted), 'base64'), btrim(p_key));
exception
  when others then
    return null;
end;
$$;

create or replace function public.get_access_entry_password(p_entry_id bigint, p_key text)
returns text
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  enc text;
  legacy text;
begin
  select password_encrypted, password
  into enc, legacy
  from public.deal_access_entries
  where id = p_entry_id;

  if enc is not null and btrim(enc) <> '' then
    return public.decrypt_access_entry_password(enc, p_key);
  end if;

  return nullif(btrim(legacy), '');
end;
$$;

create or replace function public.set_access_entry_password(
  p_entry_id bigint,
  p_password text,
  p_key text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_password is null or btrim(p_password) = '' then
    update public.deal_access_entries
    set
      password_encrypted = null,
      password = null,
      has_password = false,
      updated_at = now()
    where id = p_entry_id;
    return;
  end if;

  update public.deal_access_entries
  set
    password_encrypted = public.encrypt_access_entry_password(p_password, p_key),
    password = null,
    has_password = true,
    updated_at = now()
  where id = p_entry_id;
end;
$$;

revoke all on function public.encrypt_access_entry_password(text, text) from public;
revoke all on function public.decrypt_access_entry_password(text, text) from public;
revoke all on function public.get_access_entry_password(bigint, text) from public, authenticated;
revoke all on function public.set_access_entry_password(bigint, text, text) from public, authenticated;

grant execute on function public.get_access_entry_password(bigint, text) to service_role;
grant execute on function public.set_access_entry_password(bigint, text, text) to service_role;

revoke select (password, password_encrypted) on public.deal_access_entries from authenticated;

do $$
declare
  crypto_key text;
  row record;
begin
  crypto_key := current_setting('app.pgcrypto_key', true);
  if crypto_key is null or btrim(crypto_key) = '' then
    raise notice 'Skipping access entry password encryption backfill: app.pgcrypto_key not set';
    return;
  end if;

  for row in
    select id, password
    from public.deal_access_entries
    where password is not null
      and btrim(password) <> ''
      and (password_encrypted is null or btrim(password_encrypted) = '')
  loop
    perform public.set_access_entry_password(row.id, row.password, crypto_key);
  end loop;
end $$;
