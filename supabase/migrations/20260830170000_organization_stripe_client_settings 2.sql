-- Per-organization Stripe credentials for client payments (invoices, proposals).
-- Seat billing may still use STRIPE_SECRET_KEY env until removed.

alter table public.organizations
  add column if not exists stripe_publishable_key text,
  add column if not exists stripe_secret_key_encrypted text,
  add column if not exists stripe_client_webhook_secret_encrypted text;

comment on column public.organizations.stripe_publishable_key is
  'Stripe publishable key (pk_*) for client-facing card payments.';
comment on column public.organizations.stripe_secret_key_encrypted is
  'pgcrypto-encrypted Stripe secret key (sk_*) for client payments.';
comment on column public.organizations.stripe_client_webhook_secret_encrypted is
  'pgcrypto-encrypted signing secret for stripe-client-webhook.';

create or replace function public.encrypt_stripe_credential(p_value text, p_key text)
returns text
language plpgsql
immutable
set search_path = public, extensions
as $$
begin
  if p_value is null or btrim(p_value) = '' then
    return null;
  end if;
  if p_key is null or btrim(p_key) = '' then
    raise exception 'PGCRYPTO_KEY is required to encrypt Stripe credential';
  end if;
  return encode(extensions.pgp_sym_encrypt(btrim(p_value), btrim(p_key)), 'base64');
end;
$$;

create or replace function public.decrypt_stripe_credential(p_encrypted text, p_key text)
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
    raise exception 'PGCRYPTO_KEY is required to decrypt Stripe credential';
  end if;
  return extensions.pgp_sym_decrypt(decode(btrim(p_encrypted), 'base64'), btrim(p_key));
exception
  when others then
    return null;
end;
$$;

create or replace function public.get_org_stripe_secret_key(p_org_id bigint, p_key text)
returns text
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  enc text;
begin
  select stripe_secret_key_encrypted
  into enc
  from public.organizations
  where id = p_org_id;

  if enc is not null and btrim(enc) <> '' then
    return public.decrypt_stripe_credential(enc, p_key);
  end if;

  return null;
end;
$$;

create or replace function public.set_org_stripe_secret_key(
  p_org_id bigint,
  p_secret text,
  p_key text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_secret is null or btrim(p_secret) = '' then
    return;
  end if;

  update public.organizations
  set stripe_secret_key_encrypted = public.encrypt_stripe_credential(p_secret, p_key)
  where id = p_org_id;
end;
$$;

create or replace function public.get_org_stripe_webhook_secret(p_org_id bigint, p_key text)
returns text
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  enc text;
begin
  select stripe_client_webhook_secret_encrypted
  into enc
  from public.organizations
  where id = p_org_id;

  if enc is not null and btrim(enc) <> '' then
    return public.decrypt_stripe_credential(enc, p_key);
  end if;

  return null;
end;
$$;

create or replace function public.set_org_stripe_webhook_secret(
  p_org_id bigint,
  p_secret text,
  p_key text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_secret is null or btrim(p_secret) = '' then
    return;
  end if;

  update public.organizations
  set stripe_client_webhook_secret_encrypted =
    public.encrypt_stripe_credential(p_secret, p_key)
  where id = p_org_id;
end;
$$;

grant execute on function public.get_org_stripe_secret_key(bigint, text) to service_role;
grant execute on function public.set_org_stripe_secret_key(bigint, text, text) to service_role;
grant execute on function public.get_org_stripe_webhook_secret(bigint, text) to service_role;
grant execute on function public.set_org_stripe_webhook_secret(bigint, text, text) to service_role;
