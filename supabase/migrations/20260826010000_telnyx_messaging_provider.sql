-- Telnyx as selectable SMS + voice provider alongside Twilio.

alter table public.organization_messaging_settings
  add column if not exists messaging_provider text not null default 'twilio',
  add column if not exists telnyx_api_key_encrypted text,
  add column if not exists telnyx_phone_number text,
  add column if not exists telnyx_messaging_profile_id text,
  add column if not exists telnyx_sip_connection_id text,
  add column if not exists telnyx_telephony_credential_id text,
  add column if not exists telnyx_sip_username text,
  add column if not exists telnyx_sip_password_encrypted text,
  add column if not exists telnyx_caller_id text;

alter table public.organization_messaging_settings
  drop constraint if exists organization_messaging_settings_messaging_provider_check;

alter table public.organization_messaging_settings
  add constraint organization_messaging_settings_messaging_provider_check
  check (messaging_provider in ('twilio', 'telnyx'));

comment on column public.organization_messaging_settings.messaging_provider is
  'Active SMS/voice provider: twilio | telnyx';
comment on column public.organization_messaging_settings.telnyx_api_key_encrypted is
  'pgcrypto-encrypted Telnyx API key (base64).';
comment on column public.organization_messaging_settings.telnyx_sip_password_encrypted is
  'pgcrypto-encrypted SIP credential password for WebRTC (optional if telephony_credential_id set).';

create or replace function public.get_telnyx_api_key(p_org_id bigint, p_key text)
returns text
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  enc text;
begin
  select telnyx_api_key_encrypted into enc
  from public.organization_messaging_settings
  where org_id = p_org_id;

  if enc is not null and btrim(enc) <> '' then
    return public.decrypt_twilio_auth_token(enc, p_key);
  end if;
  return null;
end;
$$;

create or replace function public.set_telnyx_api_key(p_org_id bigint, p_token text, p_key text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_token is null or btrim(p_token) = '' then
    update public.organization_messaging_settings
    set telnyx_api_key_encrypted = null, updated_at = now()
    where org_id = p_org_id;
    return;
  end if;

  update public.organization_messaging_settings
  set
    telnyx_api_key_encrypted = public.encrypt_twilio_auth_token(p_token, p_key),
    updated_at = now()
  where org_id = p_org_id;
end;
$$;

create or replace function public.get_telnyx_sip_password(p_org_id bigint, p_key text)
returns text
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  enc text;
begin
  select telnyx_sip_password_encrypted into enc
  from public.organization_messaging_settings
  where org_id = p_org_id;

  if enc is not null and btrim(enc) <> '' then
    return public.decrypt_twilio_auth_token(enc, p_key);
  end if;
  return null;
end;
$$;

create or replace function public.set_telnyx_sip_password(p_org_id bigint, p_token text, p_key text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_token is null or btrim(p_token) = '' then
    update public.organization_messaging_settings
    set telnyx_sip_password_encrypted = null, updated_at = now()
    where org_id = p_org_id;
    return;
  end if;

  update public.organization_messaging_settings
  set
    telnyx_sip_password_encrypted = public.encrypt_twilio_auth_token(p_token, p_key),
    updated_at = now()
  where org_id = p_org_id;
end;
$$;

revoke all on function public.get_telnyx_api_key(bigint, text) from public, authenticated;
revoke all on function public.set_telnyx_api_key(bigint, text, text) from public, authenticated;
revoke all on function public.get_telnyx_sip_password(bigint, text) from public, authenticated;
revoke all on function public.set_telnyx_sip_password(bigint, text, text) from public, authenticated;

grant execute on function public.get_telnyx_api_key(bigint, text) to service_role;
grant execute on function public.set_telnyx_api_key(bigint, text, text) to service_role;
grant execute on function public.get_telnyx_sip_password(bigint, text) to service_role;
grant execute on function public.set_telnyx_sip_password(bigint, text, text) to service_role;
