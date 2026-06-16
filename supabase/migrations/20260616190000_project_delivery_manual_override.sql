-- Manual delivery override: allow a delivery to be persisted with explicit
-- override info when launch checklist required items remain incomplete.
-- Each row captures the reason + which items were force-approved by whom.

alter table public.project_deliveries
  add column if not exists manual_override jsonb;

comment on column public.project_deliveries.manual_override is
  'When non-null, this delivery was completed with the launch checklist gate bypassed. Shape: { reason: text, force_approved_items: [{ id, label, category }], approved_at: timestamptz }. The acting member is already on delivered_by_member_id.';

-- Helpful partial index for filtering manual deliveries later.
create index if not exists project_deliveries_manual_override_idx
  on public.project_deliveries ((manual_override is not null))
  where manual_override is not null;
