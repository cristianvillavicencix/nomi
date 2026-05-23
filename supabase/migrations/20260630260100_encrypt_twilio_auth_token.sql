-- Hotfix #3: Encrypt Twilio auth tokens at rest (pgcrypto).
-- Edge functions pass PGCRYPTO_KEY when calling service_role RPCs.

create extension if not exists pgcrypto with schema extensions;

alter table public.organization_messaging_settings
  add column if not exists twilio_auth_token_encrypted text;

comment on column public.organization_messaging_settings.twilio_auth_token_encrypted is
  'pgcrypto-encrypted token (base64). Plain twilio_auth_token is cleared after migration.';

create or replace function public.encrypt_twilio_auth_token(p_token text, p_key text)
returns text
language plpgsql
immutable
set search_path = public, extensions
as $$
begin
  if p_token is null or btrim(p_token) = '' then
    return null;
  end if;
  if p_key is null or btrim(p_key) = '' then
    raise exception 'PGCRYPTO_KEY is required to encrypt Twilio auth token';
  end if;
  return encode(extensions.pgp_sym_encrypt(btrim(p_token), btrim(p_key)), 'base64');
end;
$$;

create or replace function public.decrypt_twilio_auth_token(p_encrypted text, p_key text)
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
    raise exception 'PGCRYPTO_KEY is required to decrypt Twilio auth token';
  end if;
  return extensions.pgp_sym_decrypt(decode(btrim(p_encrypted), 'base64'), btrim(p_key));
exception
  when others then
    return null;
end;
$$;

create or replace function public.get_twilio_auth_token(p_org_id bigint, p_key text)
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
  select twilio_auth_token_encrypted, twilio_auth_token
  into enc, legacy
  from public.organization_messaging_settings
  where org_id = p_org_id;

  if enc is not null and btrim(enc) <> '' then
    return public.decrypt_twilio_auth_token(enc, p_key);
  end if;

  return nullif(btrim(legacy), '');
end;
$$;

create or replace function public.set_twilio_auth_token(p_org_id bigint, p_token text, p_key text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_token is null or btrim(p_token) = '' then
    return;
  end if;

  update public.organization_messaging_settings
  set
    twilio_auth_token_encrypted = public.encrypt_twilio_auth_token(p_token, p_key),
    twilio_auth_token = null,
    updated_at = now()
  where org_id = p_org_id;
end;
$$;

revoke all on function public.encrypt_twilio_auth_token(text, text) from public;
revoke all on function public.decrypt_twilio_auth_token(text, text) from public;
revoke all on function public.get_twilio_auth_token(bigint, text) from public, authenticated;
revoke all on function public.set_twilio_auth_token(bigint, text, text) from public, authenticated;

grant execute on function public.get_twilio_auth_token(bigint, text) to service_role;
grant execute on function public.set_twilio_auth_token(bigint, text, text) to service_role;

-- Idempotent backfill: when PGCRYPTO_KEY is configured at migration time via session setting.
do $$
declare
  crypto_key text;
  row record;
begin
  crypto_key := current_setting('app.pgcrypto_key', true);
  if crypto_key is null or btrim(crypto_key) = '' then
    raise notice 'Skipping Twilio token encryption backfill: app.pgcrypto_key not set';
    return;
  end if;

  for row in
    select org_id, twilio_auth_token
    from public.organization_messaging_settings
    where twilio_auth_token is not null
      and btrim(twilio_auth_token) <> ''
      and (twilio_auth_token_encrypted is null or btrim(twilio_auth_token_encrypted) = '')
  loop
    perform public.set_twilio_auth_token(row.org_id, row.twilio_auth_token, crypto_key);
  end loop;
end $$;
