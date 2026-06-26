-- Fix Security Advisor: init_state view used SECURITY DEFINER (security_invoker=off).
-- Replace with security_invoker view backed by a narrow SECURITY DEFINER function
-- that only returns whether at least one organization member exists (setup gate).

create or replace function public.crm_is_initialized()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint
  from (
    select 1
    from public.organization_members
    limit 1
  ) as initialized_probe;
$$;

comment on function public.crm_is_initialized() is
  'Returns 1 when the CRM has at least one organization member, else 0. Used for first-run setup gate.';

revoke all on function public.crm_is_initialized() from public;
grant execute on function public.crm_is_initialized() to anon, authenticated, service_role;

drop view if exists public.init_state;

create view public.init_state
with (security_invoker = true)
as
select public.crm_is_initialized() as is_initialized;

comment on view public.init_state is
  'First-run setup probe: is_initialized is 1 when at least one organization member exists.';

grant select on public.init_state to anon, authenticated, service_role;
