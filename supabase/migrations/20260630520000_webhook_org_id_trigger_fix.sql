-- Webhooks (Twilio inbound SMS) insert rows with explicit org_id via service_role.
-- trg_assign_org_id_from_session must not require auth.uid() when org_id is already set.

create or replace function public.trg_assign_org_id_from_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_org bigint;
begin
  if TG_OP = 'INSERT' and new.org_id is not null then
    return new;
  end if;

  v_org := public.current_user_org_id();
  if v_org is null then
    raise exception 'Not authenticated for org scoping';
  end if;

  if TG_OP = 'INSERT' then
    new.org_id := v_org;
  end if;

  return new;
end;
$fn$;
