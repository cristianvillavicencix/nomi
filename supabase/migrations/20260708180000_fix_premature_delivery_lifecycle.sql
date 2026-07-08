-- Pre-sale deals were inserted without lifecycle_phase and defaulted to delivery.
-- Reclassify early pipeline stages as opportunities (matches lbs_web_agency_stages_backfill).

update public.deals
set
  lifecycle_phase = 'opportunity',
  delivery_status = null
where archived_at is null
  and lifecycle_phase = 'delivery'
  and stage in ('lead', 'discovery', 'proposal_sent')
  and accepted_proposal_id is null;
