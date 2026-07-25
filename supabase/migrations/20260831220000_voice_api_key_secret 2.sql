-- Encrypt Twilio Voice API key secrets at rest (same pgcrypto helpers as SMS auth token).

create or replace function public.get_voice_api_key_secret(p_org_id bigint, p_key text)
returns text
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  enc text;
begin
  select voice_api_key_secret_encrypted
  into enc
  from public.organization_messaging_settings
  where org_id = p_org_id;

  if enc is not null and btrim(enc) <> '' then
    return public.decrypt_twilio_auth_token(enc, p_key);
  end if;

  return null;
end;
$$;

create or replace function public.set_voice_api_key_secret(
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

  update public.organization_messaging_settings
  set
    voice_api_key_secret_encrypted = public.encrypt_twilio_auth_token(p_secret, p_key),
    updated_at = now()
  where org_id = p_org_id;
end;
$$;

revoke all on function public.get_voice_api_key_secret(bigint, text) from public, authenticated;
revoke all on function public.set_voice_api_key_secret(bigint, text, text) from public, authenticated;

grant execute on function public.get_voice_api_key_secret(bigint, text) to service_role;
grant execute on function public.set_voice_api_key_secret(bigint, text, text) to service_role;
