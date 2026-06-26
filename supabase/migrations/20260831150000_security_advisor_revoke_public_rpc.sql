-- Security Advisor: clear anon RPC warnings on SECURITY DEFINER helpers.
-- Phase 1 revoked EXECUTE from anon, but PostgreSQL also grants EXECUTE to PUBLIC
-- by default, so anonymous clients could still call /rest/v1/rpc/*.
--
-- Keep EXECUTE for authenticated + service_role (RLS policies and CRM RPC).
-- Keep anon only on crm_is_initialized() (first-run setup before login).

create or replace function pg_temp.__revoke_public_rpc_access(p_signature text)
returns void
language plpgsql
as $$
declare
  fn regprocedure;
begin
  fn := to_regprocedure(p_signature);
  if fn is null then
    return;
  end if;

  execute format('revoke all on function %s from public, anon', fn);
  execute format('grant execute on function %s to authenticated, service_role', fn);
end;
$$;

do $revoke_public$
begin
  perform pg_temp.__revoke_public_rpc_access('public.can_view_contract(bigint)');
  perform pg_temp.__revoke_public_rpc_access('public.can_view_conversation(bigint)');
  perform pg_temp.__revoke_public_rpc_access('public.can_view_deal(bigint)');
  perform pg_temp.__revoke_public_rpc_access('public.can_view_proposal(bigint)');
  perform pg_temp.__revoke_public_rpc_access('public.can_view_task(bigint)');
  perform pg_temp.__revoke_public_rpc_access('public.can_view_ticket(bigint)');
  perform pg_temp.__revoke_public_rpc_access('public.can_view_voice_call(bigint)');
  perform pg_temp.__revoke_public_rpc_access('public.current_member_has_capability(text)');
  perform pg_temp.__revoke_public_rpc_access('public.current_member_is_scoped_user()');
  perform pg_temp.__revoke_public_rpc_access('public.current_user_member_id()');
  perform pg_temp.__revoke_public_rpc_access('public.current_user_org_id()');
  perform pg_temp.__revoke_public_rpc_access('public.ensure_project_conversation(bigint, text)');
  perform pg_temp.__revoke_public_rpc_access('public.get_unread_counts_for_conversations(bigint[])');
  perform pg_temp.__revoke_public_rpc_access('public.is_admin()');
  perform pg_temp.__revoke_public_rpc_access('public.is_conversation_participant(bigint, bigint)');
  perform pg_temp.__revoke_public_rpc_access('public.is_platform_operator()');
  perform pg_temp.__revoke_public_rpc_access('public.user_can_access_conversation(bigint)');

  -- Setup gate: anon may still call before login; drop only the PUBLIC grant.
  perform pg_temp.__revoke_public_rpc_access('public.crm_is_initialized()');
  execute 'grant execute on function public.crm_is_initialized() to anon';
end;
$revoke_public$;
