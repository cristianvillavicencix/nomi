-- ============================================================================
-- 05_dry_run_promotable_companies.sql
--
-- Read-only report: companies whose primary contact is contact_only and would
-- be promoted to client by script 05 backfill.
--
-- Usage:
--   npx supabase db query --linked --agent=no -f scripts/cleanup/05_dry_run_promotable_companies.sql
--   npx supabase db query --linked --agent=no --output csv -f scripts/cleanup/05_dry_run_promotable_companies.sql
-- ============================================================================

select
  co.id as company_id,
  co.name as company_name,
  coalesce(co.sector, '') as sector,
  c.id as primary_contact_id,
  trim(
    coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')
  ) as primary_contact_name,
  c.status as primary_status,
  (
    select count(*)::int
    from public.deals d
    where d.company_id = co.id
  ) as deals_count,
  (
    select count(*)::int
    from public.proposals p
    where p.company_id = co.id
  ) as proposals_count,
  (
    select count(*)::int
    from public.client_invoices i
    where i.company_id = co.id
  ) as invoices_count,
  (
    select count(*)::int
    from public.deals d
    where d.company_id = co.id
  ) + (
    select count(*)::int
    from public.proposals p
    where p.company_id = co.id
  ) + (
    select count(*)::int
    from public.client_invoices i
    where i.company_id = co.id
  ) as activity_total
from public.companies co
join public.contacts c on c.id = co.primary_contact_id
where c.status = 'contact_only'
order by activity_total desc, co.name asc;
