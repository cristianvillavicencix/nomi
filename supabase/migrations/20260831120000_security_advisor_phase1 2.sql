-- Security Advisor phase 1 (low risk):
-- 1. Pin search_path on functions flagged by function_search_path_mutable.
-- 2. Revoke direct RPC access to cron/secret helpers (service_role only).
-- 3. Revoke direct RPC access to SECURITY DEFINER trigger helpers.
-- 4. Revoke anon-only RPC on functions still required by authenticated users / RLS.
--
-- Does NOT change: RLS policies, storage buckets, or authenticated grants on can_view_* / ensure_project_conversation.
-- After apply: enable leaked-password protection in Dashboard → Auth → Providers → Email.

-- ---------------------------------------------------------------------------
-- Helpers (migration-local)
-- ---------------------------------------------------------------------------

create or replace function pg_temp.__security_phase1_set_search_path(
  p_signature text,
  p_search_path text default 'public'
)
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

  execute format(
    'alter function %s set search_path = %L',
    fn,
    p_search_path
  );
end;
$$;

create or replace function pg_temp.__security_phase1_lock_service_only(
  p_signature text
)
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

  execute format('revoke all on function %s from public, anon, authenticated', fn);
  execute format('grant execute on function %s to service_role', fn);
end;
$$;

create or replace function pg_temp.__security_phase1_lock_trigger_helper(
  p_signature text
)
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

  execute format('revoke all on function %s from public, anon, authenticated', fn);
end;
$$;

create or replace function pg_temp.__security_phase1_revoke_anon(
  p_signature text
)
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

  execute format('revoke all on function %s from anon', fn);
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. search_path (Security Advisor: function_search_path_mutable)
-- ---------------------------------------------------------------------------

do $search_path$
begin
  perform pg_temp.__security_phase1_set_search_path(
    'public.build_conversation_message_preview(text, text, boolean)'
  );
  perform pg_temp.__security_phase1_set_search_path(
    'public.cleanup_old_web_monitor_data()'
  );
  perform pg_temp.__security_phase1_set_search_path(
    'public.current_user_has_any_role(text[])'
  );
  perform pg_temp.__security_phase1_set_search_path(
    'public.current_user_is_administrator()'
  );
  perform pg_temp.__security_phase1_set_search_path(
    'public.extract_domain_from_url(text)'
  );
  perform pg_temp.__security_phase1_set_search_path(
    'public.get_avatar_for_email(text)',
    'public, extensions'
  );
  perform pg_temp.__security_phase1_set_search_path(
    'public.get_domain_favicon(text)'
  );
  perform pg_temp.__security_phase1_set_search_path(
    'public.get_user_id_by_email(text)',
    'public, auth'
  );
  perform pg_temp.__security_phase1_set_search_path(
    'public.handle_company_saved()'
  );
  perform pg_temp.__security_phase1_set_search_path(
    'public.handle_contact_saved()',
    'public, extensions'
  );
  perform pg_temp.__security_phase1_set_search_path(
    'public.handle_recompute_deal_current_project_value_from_change_orders()'
  );
  perform pg_temp.__security_phase1_set_search_path(
    'public.handle_recompute_deal_current_project_value_from_deals()'
  );
  perform pg_temp.__security_phase1_set_search_path(
    'public.merge_contacts(bigint, bigint)'
  );
  perform pg_temp.__security_phase1_set_search_path(
    'public.normalize_website_monitor_url(text)'
  );
  perform pg_temp.__security_phase1_set_search_path(
    'public.recalculate_payment_totals(bigint)'
  );
  perform pg_temp.__security_phase1_set_search_path(
    'public.recompute_deal_current_project_value(bigint)'
  );
  perform pg_temp.__security_phase1_set_search_path(
    'public.set_organization_member_id_default()'
  );
  perform pg_temp.__security_phase1_set_search_path(
    'public.set_updated_at()'
  );
  perform pg_temp.__security_phase1_set_search_path(
    'public.sync_ticket_member_read_org()'
  );
  perform pg_temp.__security_phase1_set_search_path(
    'public.tg_google_gsc_credentials_set_updated_at()'
  );
  perform pg_temp.__security_phase1_set_search_path(
    'public.tg_zoho_oauth_credentials_set_updated_at()'
  );
end;
$search_path$;

-- ---------------------------------------------------------------------------
-- 2. Cron, secrets, and legacy admin RPC (service_role only)
-- ---------------------------------------------------------------------------

do $service_only$
begin
  perform pg_temp.__security_phase1_lock_service_only(
    'public.cleanup_old_web_monitor_data()'
  );
  perform pg_temp.__security_phase1_lock_service_only(
    'public.invoke_client_invoice_billing_cron(text)'
  );
  perform pg_temp.__security_phase1_lock_service_only(
    'public.invoke_send_calendar_reminders()'
  );
  perform pg_temp.__security_phase1_lock_service_only(
    'public.invoke_website_audit_schedule(text)'
  );
  perform pg_temp.__security_phase1_lock_service_only(
    'public.invoke_website_monitor_check(bigint)'
  );
  perform pg_temp.__security_phase1_lock_service_only(
    'public.invoke_website_monitor_run()'
  );
  perform pg_temp.__security_phase1_lock_service_only(
    'public.fail_stale_website_audits(integer)'
  );
  perform pg_temp.__security_phase1_lock_service_only(
    'public.find_contact_by_phone(bigint, text)'
  );
  perform pg_temp.__security_phase1_lock_service_only(
    'public.get_access_entry_password(bigint, text)'
  );
  perform pg_temp.__security_phase1_lock_service_only(
    'public.set_access_entry_password(bigint, text, text)'
  );
  perform pg_temp.__security_phase1_lock_service_only(
    'public.get_deal_secret_value(bigint, text)'
  );
  perform pg_temp.__security_phase1_lock_service_only(
    'public.set_deal_secret_value(bigint, text, text)'
  );
  perform pg_temp.__security_phase1_lock_service_only(
    'public.get_twilio_auth_token(bigint, text)'
  );
  perform pg_temp.__security_phase1_lock_service_only(
    'public.set_twilio_auth_token(bigint, text, text)'
  );
  perform pg_temp.__security_phase1_lock_service_only(
    'public.encrypt_twilio_auth_token(text, text)'
  );
  perform pg_temp.__security_phase1_lock_service_only(
    'public.decrypt_twilio_auth_token(text, text)'
  );
  perform pg_temp.__security_phase1_lock_service_only(
    'public.encrypt_access_entry_password(text, text)'
  );
  perform pg_temp.__security_phase1_lock_service_only(
    'public.decrypt_access_entry_password(text, text)'
  );
  perform pg_temp.__security_phase1_lock_service_only(
    'public.next_client_invoice_number(bigint)'
  );
  perform pg_temp.__security_phase1_lock_service_only(
    'public.purge_expired_portal_sensitive_sessions()'
  );
  perform pg_temp.__security_phase1_lock_service_only(
    'public.get_user_id_by_email(text)'
  );
  perform pg_temp.__security_phase1_lock_service_only(
    'public.migrate_legacy_task_mentions()'
  );
  perform pg_temp.__security_phase1_lock_service_only(
    'public.merge_contacts(bigint, bigint)'
  );
  perform pg_temp.__security_phase1_lock_service_only(
    'public.sync_monitored_websites_for_org(bigint)'
  );
end;
$service_only$;

-- ---------------------------------------------------------------------------
-- 3. Trigger helpers (not callable via PostgREST; triggers run as table owner)
-- ---------------------------------------------------------------------------

do $trigger_helpers$
begin
  perform pg_temp.__security_phase1_lock_trigger_helper(
    'public.archive_form_version()'
  );
  perform pg_temp.__security_phase1_lock_trigger_helper(
    'public.ensure_assignee_is_participant()'
  );
  perform pg_temp.__security_phase1_lock_trigger_helper(
    'public.handle_contact_note_created_or_updated()'
  );
  perform pg_temp.__security_phase1_lock_trigger_helper(
    'public.handle_new_user()'
  );
  perform pg_temp.__security_phase1_lock_trigger_helper(
    'public.handle_outbound_message_contact_touch()'
  );
  perform pg_temp.__security_phase1_lock_trigger_helper(
    'public.handle_update_user()'
  );
  perform pg_temp.__security_phase1_lock_trigger_helper(
    'public.set_created_by_member_id()'
  );
  perform pg_temp.__security_phase1_lock_trigger_helper(
    'public.set_form_instance_default_notify()'
  );
  perform pg_temp.__security_phase1_lock_trigger_helper(
    'public.set_form_instance_defaults()'
  );
  perform pg_temp.__security_phase1_lock_trigger_helper(
    'public.set_form_template_org_id()'
  );
  perform pg_temp.__security_phase1_lock_trigger_helper(
    'public.sync_deal_stage_to_contact_lead_stage()'
  );
  perform pg_temp.__security_phase1_lock_trigger_helper(
    'public.sync_org_name_from_config()'
  );
  perform pg_temp.__security_phase1_lock_trigger_helper(
    'public.sync_primary_contact_client_status()'
  );
  perform pg_temp.__security_phase1_lock_trigger_helper(
    'public.trg_assign_org_id_from_session()'
  );
  perform pg_temp.__security_phase1_lock_trigger_helper(
    'public.trg_company_sync_monitored_website()'
  );
  perform pg_temp.__security_phase1_lock_trigger_helper(
    'public.trg_contacts_sync_membership()'
  );
  perform pg_temp.__security_phase1_lock_trigger_helper(
    'public.trg_conversation_message_touch_conversation()'
  );
  perform pg_temp.__security_phase1_lock_trigger_helper(
    'public.trg_conversations_set_creator()'
  );
  perform pg_temp.__security_phase1_lock_trigger_helper(
    'public.trg_deal_resources_system_log()'
  );
  perform pg_temp.__security_phase1_lock_trigger_helper(
    'public.trg_deals_system_create_log()'
  );
  perform pg_temp.__security_phase1_lock_trigger_helper(
    'public.trg_deals_system_delivery_status_log()'
  );
  perform pg_temp.__security_phase1_lock_trigger_helper(
    'public.trg_deals_system_stage_change_log()'
  );
  perform pg_temp.__security_phase1_lock_trigger_helper(
    'public.trg_deals_system_team_log()'
  );
  perform pg_temp.__security_phase1_lock_trigger_helper(
    'public.trg_monitored_website_enqueue_check()'
  );
  perform pg_temp.__security_phase1_lock_trigger_helper(
    'public.trg_task_assignee_notify()'
  );
  perform pg_temp.__security_phase1_lock_trigger_helper(
    'public.trg_tasks_system_log()'
  );
  perform pg_temp.__security_phase1_lock_trigger_helper(
    'public.promote_contact_to_client(bigint)'
  );
  perform pg_temp.__security_phase1_lock_trigger_helper(
    'public.promote_contact_to_client_on_contact_change()'
  );
  perform pg_temp.__security_phase1_lock_trigger_helper(
    'public.sync_contact_membership(bigint)'
  );
  perform pg_temp.__security_phase1_lock_trigger_helper(
    'public.post_project_system_message(bigint, text)'
  );
  perform pg_temp.__security_phase1_lock_trigger_helper(
    'public.member_display_name(bigint)'
  );
  perform pg_temp.__security_phase1_lock_trigger_helper(
    'public.rls_auto_enable()'
  );
end;
$trigger_helpers$;

-- ---------------------------------------------------------------------------
-- 4. Block anonymous RPC on app helpers (keep authenticated + RLS working)
-- ---------------------------------------------------------------------------

do $revoke_anon$
begin
  perform pg_temp.__security_phase1_revoke_anon(
    'public.can_view_contract(bigint)'
  );
  perform pg_temp.__security_phase1_revoke_anon(
    'public.can_view_conversation(bigint)'
  );
  perform pg_temp.__security_phase1_revoke_anon(
    'public.can_view_deal(bigint)'
  );
  perform pg_temp.__security_phase1_revoke_anon(
    'public.can_view_proposal(bigint)'
  );
  perform pg_temp.__security_phase1_revoke_anon(
    'public.can_view_task(bigint)'
  );
  perform pg_temp.__security_phase1_revoke_anon(
    'public.can_view_ticket(bigint)'
  );
  perform pg_temp.__security_phase1_revoke_anon(
    'public.can_view_voice_call(bigint)'
  );
  perform pg_temp.__security_phase1_revoke_anon(
    'public.current_member_has_capability(text)'
  );
  perform pg_temp.__security_phase1_revoke_anon(
    'public.current_member_is_scoped_user()'
  );
  perform pg_temp.__security_phase1_revoke_anon(
    'public.current_user_member_id()'
  );
  perform pg_temp.__security_phase1_revoke_anon(
    'public.current_user_org_id()'
  );
  perform pg_temp.__security_phase1_revoke_anon(
    'public.ensure_project_conversation(bigint, text)'
  );
  perform pg_temp.__security_phase1_revoke_anon(
    'public.get_unread_counts_for_conversations(bigint[])'
  );
  perform pg_temp.__security_phase1_revoke_anon(
    'public.is_admin()'
  );
  perform pg_temp.__security_phase1_revoke_anon(
    'public.is_conversation_participant(bigint, bigint)'
  );
  perform pg_temp.__security_phase1_revoke_anon(
    'public.is_platform_operator()'
  );
  perform pg_temp.__security_phase1_revoke_anon(
    'public.user_can_access_conversation(bigint)'
  );
  -- crm_is_initialized() intentionally keeps anon for first-run setup gate.
end;
$revoke_anon$;
