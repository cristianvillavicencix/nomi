-- Hostinger Mail API token (read mailboxes per domain).

alter table public.organization_hostinger_settings
  add column if not exists mail_api_token_encrypted text;

comment on column public.organization_hostinger_settings.mail_api_token_encrypted is
  'Encrypted Hostinger Mail API token (api.mail.hostinger.com) for listing mailboxes.';

create or replace function public.get_hostinger_mail_api_token(p_org_id bigint, p_key text)
returns text
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  enc text;
begin
  select mail_api_token_encrypted
  into enc
  from public.organization_hostinger_settings
  where org_id = p_org_id;

  if enc is not null and btrim(enc) <> '' then
    return public.decrypt_hostinger_api_token(enc, p_key);
  end if;

  return null;
end;
$$;

create or replace function public.set_hostinger_mail_api_token(p_org_id bigint, p_token text, p_key text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into public.organization_hostinger_settings (org_id, mail_api_token_encrypted, updated_at)
  values (
    p_org_id,
    public.encrypt_hostinger_api_token(p_token, p_key),
    now()
  )
  on conflict (org_id) do update
  set
    mail_api_token_encrypted = excluded.mail_api_token_encrypted,
    updated_at = now();
end;
$$;

revoke all on function public.get_hostinger_mail_api_token(bigint, text) from public, authenticated;
revoke all on function public.set_hostinger_mail_api_token(bigint, text, text) from public, authenticated;

grant execute on function public.get_hostinger_mail_api_token(bigint, text) to service_role;
grant execute on function public.set_hostinger_mail_api_token(bigint, text, text) to service_role;
