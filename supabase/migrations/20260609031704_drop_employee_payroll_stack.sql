-- Drop employee / payroll / contractor-deal economics stack (IRREVERSIBLE).
--
-- B0 row counts at backup time (2026-06-02, org Latino Business Support):
--   people: 1
--   payroll_runs: 1
--   payroll_run_lines: 1
--   employee_loans: 0
--   employee_loan_deductions: 0
--   employee_pto_adjustments: 0
--   time_entries: 0
--   payments: 0
--   payment_lines: 0
--   deal_commissions: 0
--   deal_subcontractors: 0
--   deal_subcontractor_entries: 0
--   deal_workers: 0
--   deal_salespersons: 0
--   task_assignees: 0
-- Backup CSVs: backups/employee-stack-20260602/

-- ---------------------------------------------------------------------------
-- 0) Rewrite scoped-access helpers (organization_members only; drop people link)
-- ---------------------------------------------------------------------------

create or replace function public.can_view_deal(p_deal_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select id, administrator, org_id
    from public.organization_members
    where user_id = auth.uid()
    limit 1
  )
  select case
    when not exists (select 1 from me) then false
    when (select administrator from me) then true
    when not exists (select 1 from public.deals where id = p_deal_id) then false
    when (select org_id from public.deals where id = p_deal_id)
      is distinct from (select org_id from me) then false
    when not public.current_member_is_scoped_user() then true
    else exists (
      select 1
      from public.deals d
      cross join me
      where d.id = p_deal_id
        and d.org_id = me.org_id
        and (
          d.organization_member_id = me.id
          or me.id = any (d.salesperson_ids)
          or exists (
            select 1
            from public.record_shares rs
            where rs.resource_type = 'deals'
              and rs.resource_id = d.id
              and rs.member_id = me.id
          )
        )
    )
  end;
$$;

create or replace function public.can_view_task(p_task_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select id, administrator, org_id
    from public.organization_members
    where user_id = auth.uid()
    limit 1
  )
  select case
    when not exists (select 1 from me) then false
    when (select administrator from me) then true
    when not public.current_member_is_scoped_user() then true
    else exists (
      select 1
      from public.tasks t
      cross join me
      where t.id = p_task_id
        and t.org_id = me.org_id
        and (
          t.organization_member_id = me.id
          or me.id = any (t.assignee_person_ids)
          or me.id = any (t.collaborator_person_ids)
          or me.id = any (t.mentioned_member_ids)
          or exists (
            select 1
            from public.record_shares rs
            where rs.resource_type = 'tasks'
              and rs.resource_id = t.id
              and rs.member_id = me.id
          )
        )
    )
  end;
$$;

grant execute on function public.can_view_deal(bigint) to authenticated;
grant execute on function public.can_view_task(bigint) to authenticated;

drop function if exists public.current_user_person_id();

-- ---------------------------------------------------------------------------
-- 1) Fix surviving RLS policies that still reference person_id / people
-- ---------------------------------------------------------------------------

drop policy if exists "task_tag_notifications_insert" on public.task_tag_notifications;

create policy "task_tag_notifications_insert" on public.task_tag_notifications
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.tasks t
      where t.id = task_tag_notifications.task_id
        and t.org_id = public.current_user_org_id()
    )
    and exists (
      select 1
      from public.organization_members om
      where om.id = task_tag_notifications.recipient_organization_member_id
        and om.org_id = public.current_user_org_id()
        and coalesce(om.disabled, false) = false
    )
  );

-- calendar_events + task_participants policies are org-scoped only (no person_id).

-- ---------------------------------------------------------------------------
-- 2) Detach surviving tables from public.people
-- ---------------------------------------------------------------------------

-- Verified in prod: calendar_events_person_id_idx and *_uidx names are indexes.
-- task_tag_notifications_task_id_person_id_recipient_organiza_key is a UNIQUE CONSTRAINT.
drop index if exists public.calendar_events_person_id_idx;
drop index if exists public.task_participants_task_person_uidx;
drop index if exists public.task_tag_notifications_person_tag_uidx;
drop index if exists public.task_tag_notifications_member_tag_uidx;

alter table if exists public.task_tag_notifications
  drop constraint if exists task_tag_notifications_task_id_person_id_recipient_organiza_key;

alter table if exists public.calendar_events
  drop constraint if exists calendar_events_person_id_fkey;

alter table if exists public.calendar_events
  drop column if exists person_id;

alter table if exists public.task_participants
  drop constraint if exists task_participants_person_id_fkey;

alter table if exists public.task_participants
  drop constraint if exists task_participants_person_or_member_chk;

alter table if exists public.task_participants
  drop column if exists person_id;

alter table if exists public.task_tag_notifications
  drop constraint if exists task_tag_notifications_person_id_fkey;

alter table if exists public.task_tag_notifications
  drop column if exists person_id;

create unique index if not exists task_tag_notifications_member_tag_uidx
  on public.task_tag_notifications (task_id, recipient_organization_member_id);

-- ---------------------------------------------------------------------------
-- 3) Drop people-linked function signature, then tables (CASCADE drops triggers)
-- ---------------------------------------------------------------------------

drop function if exists public.build_task_person_mention_token(public.people);

drop table if exists public.payment_lines cascade;
drop table if exists public.time_entries cascade;
drop table if exists public.payroll_run_lines cascade;
drop table if exists public.employee_loan_deductions cascade;
drop table if exists public.employee_pto_adjustments cascade;
drop table if exists public.employee_loans cascade;
drop table if exists public.payments cascade;
drop table if exists public.payroll_runs cascade;
drop table if exists public.deal_commissions cascade;
drop table if exists public.deal_subcontractor_entries cascade;
drop table if exists public.deal_subcontractors cascade;
drop table if exists public.deal_workers cascade;
drop table if exists public.deal_salespersons cascade;
drop table if exists public.task_assignees cascade;
drop table if exists public.people cascade;

-- ---------------------------------------------------------------------------
-- 4) Drop orphaned payroll helper functions
-- ---------------------------------------------------------------------------

drop function if exists public.generate_payment_lines(bigint);
drop function if exists public.generate_payroll_run(bigint);
drop function if exists public.release_payroll_run_linked_resources(bigint);
drop function if exists public.release_payroll_run_resources_on_cancel();
drop function if exists public.mark_payment_time_entries_paid();
drop function if exists public.mark_payroll_run_entries_paid();
drop function if exists public.normalize_time_entry_payroll_state();
drop function if exists public.payment_lines_sync_payment_totals();
drop function if exists public.prevent_sales_commissions_payroll_runs();
drop function if exists public.recalculate_payment_totals();
drop function if exists public.sync_payment_with_payroll_run();
drop function if exists public.sync_payroll_run_when_payment_paid();
drop function if exists public.validate_payment_line_source_integrity();
drop function if exists public.enforce_payment_status_transition();
drop function if exists public.enforce_payroll_run_status_transition();
