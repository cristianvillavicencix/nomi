-- ============================================================================
-- 03_normalize_company_sector.sql
--
-- Why: companies.sector mixes legacy labels ("Roofing"), trade slugs, and GICS.
--      Canonical vocabulary = LBS_COMPANY_INDUSTRY_CHOICES (see leadFormConstants.ts).
--
-- Maps known labels/slugs to canonical ids. Flags unknown/GICS for manual review.
-- Empty/null sectors are left unchanged.
--
-- Usage: run as-is for dry-run. Set apply_changes := true to apply.
-- ============================================================================

DO $$
DECLARE
  apply_changes boolean := false;
  v_count integer;
  rec record;
BEGIN
  RAISE NOTICE '=== 03 normalize company sector (apply=%) ===', apply_changes;

  -- Proposed mapping preview with counts
  FOR rec IN
    WITH mapped AS (
      SELECT
        c.id,
        c.sector AS current_sector,
        CASE lower(trim(c.sector))
          WHEN 'roofing' THEN 'roofing'
          WHEN 'landscaping' THEN 'landscaping'
          WHEN 'remodeling' THEN 'remodeling'
          WHEN 'restoration' THEN 'restoration'
          WHEN 'real estate' THEN 'real-estate'
          WHEN 'siding' THEN 'siding'
          WHEN 'exterior remodeling' THEN 'exterior-remodeling'
          WHEN 'general contractor' THEN 'general-contractor'
          WHEN 'home improvement' THEN 'home-improvement'
          WHEN 'hvac' THEN 'hvac'
          WHEN 'plumbing' THEN 'plumbing'
          WHEN 'electrical' THEN 'electrical'
          WHEN 'painting' THEN 'painting'
          WHEN 'cleaning' THEN 'cleaning'
          WHEN 'other' THEN 'other'
          WHEN 'utilities' THEN 'NEEDS_MANUAL_MAP'
          WHEN 'information-technology' THEN 'NEEDS_MANUAL_MAP'
          WHEN 'management isv' THEN 'NEEDS_MANUAL_MAP'
          ELSE CASE
            WHEN c.sector IS NULL OR trim(c.sector) = '' THEN 'UNCHANGED_EMPTY'
            WHEN c.sector = lower(trim(c.sector)) AND c.sector NOT IN (
              'roofing','landscaping','remodeling','restoration','real-estate',
              'siding','exterior-remodeling','general-contractor','home-improvement',
              'hvac','plumbing','electrical','painting','cleaning','other'
            ) THEN 'NEEDS_MANUAL_MAP'
            ELSE 'NEEDS_MANUAL_MAP'
          END
        END AS target_slug
      FROM public.companies c
    )
    SELECT target_slug, count(*) AS n
    FROM mapped
    GROUP BY target_slug
    ORDER BY n DESC
  LOOP
    RAISE NOTICE '  MAP % -> % rows', rec.target_slug, rec.n;
  END LOOP;

  RAISE NOTICE 'Sample rows needing manual map:';
  FOR rec IN
    SELECT c.id, c.name, c.sector
    FROM public.companies c
    WHERE c.sector IS NOT NULL
      AND trim(c.sector) <> ''
      AND lower(trim(c.sector)) NOT IN (
        'roofing','landscaping','remodeling','restoration','real estate',
        'siding','exterior remodeling','general contractor','home improvement',
        'hvac','plumbing','electrical','painting','cleaning','other',
        'utilities','information-technology','management isv'
      )
      AND c.sector NOT IN (
        'roofing','landscaping','remodeling','restoration','real-estate',
        'siding','exterior-remodeling','general-contractor','home-improvement',
        'hvac','plumbing','electrical','painting','cleaning','other'
      )
    ORDER BY c.id
    LIMIT 20
  LOOP
    RAISE NOTICE '  MANUAL id=% name=% sector=%', rec.id, rec.name, rec.sector;
  END LOOP;

  IF NOT apply_changes THEN
    RAISE NOTICE 'DRY-RUN complete. Set apply_changes := true to apply (skips NEEDS_MANUAL_MAP).';
    RETURN;
  END IF;

  BEGIN
    UPDATE public.companies c
    SET sector = CASE lower(trim(c.sector))
      WHEN 'roofing' THEN 'roofing'
      WHEN 'landscaping' THEN 'landscaping'
      WHEN 'remodeling' THEN 'remodeling'
      WHEN 'restoration' THEN 'restoration'
      WHEN 'real estate' THEN 'real-estate'
      WHEN 'siding' THEN 'siding'
      WHEN 'exterior remodeling' THEN 'exterior-remodeling'
      WHEN 'general contractor' THEN 'general-contractor'
      WHEN 'home improvement' THEN 'home-improvement'
      WHEN 'hvac' THEN 'hvac'
      WHEN 'plumbing' THEN 'plumbing'
      WHEN 'electrical' THEN 'electrical'
      WHEN 'painting' THEN 'painting'
      WHEN 'cleaning' THEN 'cleaning'
      WHEN 'other' THEN 'other'
      WHEN 'utilities' THEN 'other'
      WHEN 'information-technology' THEN 'other'
      WHEN 'management isv' THEN 'other'
      ELSE c.sector
    END
    WHERE c.sector IS NOT NULL
      AND trim(c.sector) <> ''
      AND (
        c.sector <> lower(trim(c.sector))
        OR c.sector IN (
          'Roofing','Restoration','Real Estate','Siding','Exterior Remodeling',
          'General Contractor','Home Improvement','Management ISV'
        )
      )
      AND lower(trim(c.sector)) NOT IN ('utilities', 'information-technology', 'management isv');

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'APPLIED: normalized sector on % companies', v_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '03_normalize_company_sector failed: %', SQLERRM;
  END;
END $$;
