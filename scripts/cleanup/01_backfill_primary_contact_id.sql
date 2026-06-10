-- ============================================================================
-- 01_backfill_primary_contact_id.sql
--
-- Why: 183 companies have primary_contact_id NULL but do have contacts.
--      The companies_summary view resolves primary via heuristic; persisting
--      the FK makes lists and joins consistent.
--
-- Rule (matches companies_summary lateral join):
--   ORDER BY status = 'client' first, first_seen ASC NULLS LAST, id ASC
--   LIMIT 1
--
-- Does NOT touch companies with zero contacts (listed in dry-run only).
-- Idempotent: skips rows where primary_contact_id is already set.
--
-- Usage: run as-is for dry-run. Set apply_changes := true to apply.
-- ============================================================================

DO $$
DECLARE
  apply_changes boolean := false;
  v_count integer;
  rec record;
BEGIN
  RAISE NOTICE '=== 01 backfill primary_contact_id (apply=%) ===', apply_changes;

  -- Companies with no contacts (manual review only)
  SELECT count(*) INTO v_count
  FROM public.companies c
  WHERE NOT EXISTS (
    SELECT 1 FROM public.contacts ct WHERE ct.company_id = c.id
  );
  RAISE NOTICE 'Companies with ZERO contacts (skipped): %', v_count;

  FOR rec IN
    SELECT c.id, c.name, c.sector, c.created_at
    FROM public.companies c
    WHERE NOT EXISTS (
      SELECT 1 FROM public.contacts ct WHERE ct.company_id = c.id
    )
    ORDER BY c.id
  LOOP
    RAISE NOTICE '  NO_CONTACT company id=% name=% sector=% created=%',
      rec.id, rec.name, coalesce(rec.sector, ''), rec.created_at;
  END LOOP;

  -- Rows that would be updated
  SELECT count(*) INTO v_count
  FROM public.companies c
  WHERE c.primary_contact_id IS NULL
    AND EXISTS (SELECT 1 FROM public.contacts ct WHERE ct.company_id = c.id);
  RAISE NOTICE 'Companies to backfill (have contacts, null primary_contact_id): %', v_count;

  FOR rec IN
    SELECT
      c.id AS company_id,
      c.name AS company_name,
      pick.contact_id,
      pick.first_name,
      pick.last_name,
      pick.status
    FROM public.companies c
    CROSS JOIN LATERAL (
      SELECT
        pco.id AS contact_id,
        pco.first_name,
        pco.last_name,
        pco.status
      FROM public.contacts pco
      WHERE pco.company_id = c.id
      ORDER BY
        CASE WHEN pco.status = 'client' THEN 0 ELSE 1 END,
        pco.first_seen ASC NULLS LAST,
        pco.id ASC
      LIMIT 1
    ) pick
    WHERE c.primary_contact_id IS NULL
    ORDER BY c.id
    LIMIT 15
  LOOP
    RAISE NOTICE '  SAMPLE company_id=% name=% -> contact_id=% (% %, status=%)',
      rec.company_id, rec.company_name, rec.contact_id,
      rec.first_name, rec.last_name, rec.status;
  END LOOP;

  IF NOT apply_changes THEN
    RAISE NOTICE 'DRY-RUN complete. Set apply_changes := true to apply.';
    RETURN;
  END IF;

  BEGIN
    UPDATE public.companies c
    SET primary_contact_id = (
      SELECT pco.id
      FROM public.contacts pco
      WHERE pco.company_id = c.id
      ORDER BY
        CASE WHEN pco.status = 'client' THEN 0 ELSE 1 END,
        pco.first_seen ASC NULLS LAST,
        pco.id ASC
      LIMIT 1
    )
    WHERE c.primary_contact_id IS NULL
      AND EXISTS (SELECT 1 FROM public.contacts ct WHERE ct.company_id = c.id);

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'APPLIED: updated % companies', v_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '01_backfill_primary_contact_id failed: %', SQLERRM;
  END;
END $$;
