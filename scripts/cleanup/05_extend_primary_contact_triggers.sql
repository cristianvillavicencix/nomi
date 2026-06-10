-- ============================================================================
-- 05_extend_primary_contact_triggers.sql
--
-- Phase 3 Block D: primary contact promotion / demotion
--
-- D.1: When assigned as companies.primary_contact_id, promote to `client`
--      from ANY non-client status (including contact_only).
-- D.2: When replaced as primary, demote outgoing contact to `contact_only`
--      if they are not primary on any other company.
--
-- Usage: run as-is for dry-run. Set apply_changes := true to apply.
-- ============================================================================

DO $$
DECLARE
  apply_changes boolean := false;
  v_count integer;
  rec record;
BEGIN
  RAISE NOTICE '=== 05 extend primary contact triggers (apply=%) ===', apply_changes;

  -- D.1 dry-run: contact_only primaries that would be promoted
  SELECT count(*) INTO v_count
  FROM public.contacts c
  WHERE c.status = 'contact_only'
    AND EXISTS (
      SELECT 1
      FROM public.companies co
      WHERE co.primary_contact_id = c.id
    );
  RAISE NOTICE 'D.1: contact_only contacts who are company primary (would promote to client): %', v_count;
  RAISE NOTICE 'D.1 detail: run scripts/cleanup/05_dry_run_promotable_companies.sql for full company list with deals/proposals/invoices counts';

  SELECT count(*) INTO v_count
  FROM public.companies co
  JOIN public.contacts c ON c.id = co.primary_contact_id
  WHERE c.status = 'contact_only'
    AND (
      EXISTS (SELECT 1 FROM public.deals d WHERE d.company_id = co.id)
      OR EXISTS (SELECT 1 FROM public.proposals p WHERE p.company_id = co.id)
      OR EXISTS (SELECT 1 FROM public.client_invoices i WHERE i.company_id = co.id)
    );
  RAISE NOTICE 'D.1: companies with any deals/proposals/invoices (activity): %', v_count;

  IF v_count > 0 AND v_count <= 20 THEN
    RAISE NOTICE 'D.1 companies with activity:';
    FOR rec IN
      SELECT
        co.id AS company_id,
        co.name AS company_name,
        coalesce(co.sector, '') AS sector,
        (SELECT count(*) FROM public.deals d WHERE d.company_id = co.id) AS deals_count,
        (SELECT count(*) FROM public.proposals p WHERE p.company_id = co.id) AS proposals_count,
        (SELECT count(*) FROM public.client_invoices i WHERE i.company_id = co.id) AS invoices_count
      FROM public.companies co
      JOIN public.contacts c ON c.id = co.primary_contact_id
      WHERE c.status = 'contact_only'
        AND (
          EXISTS (SELECT 1 FROM public.deals d WHERE d.company_id = co.id)
          OR EXISTS (SELECT 1 FROM public.proposals p WHERE p.company_id = co.id)
          OR EXISTS (SELECT 1 FROM public.client_invoices i WHERE i.company_id = co.id)
        )
      ORDER BY co.name
    LOOP
      RAISE NOTICE '  company_id=% name=% sector=% deals=% proposals=% invoices=%',
        rec.company_id, rec.company_name, rec.sector,
        rec.deals_count, rec.proposals_count, rec.invoices_count;
    END LOOP;
  END IF;

  -- Legacy sample (first 20 contact rows) — prefer 05_dry_run_promotable_companies.sql
  SELECT count(*) INTO v_count
  FROM public.contacts c
  WHERE c.status = 'contact_only'
    AND EXISTS (SELECT 1 FROM public.companies co WHERE co.primary_contact_id = c.id);

  IF v_count > 0 AND v_count <= 20 THEN
    RAISE NOTICE 'D.1 sample rows:';
    FOR rec IN
      SELECT c.id, c.first_name, c.last_name, c.status, co.id AS company_id, co.name AS company_name
      FROM public.contacts c
      JOIN public.companies co ON co.primary_contact_id = c.id
      WHERE c.status = 'contact_only'
      ORDER BY c.id
      LIMIT 20
    LOOP
      RAISE NOTICE '  contact_id=% name=% % company_id=% company=%',
        rec.id, rec.first_name, rec.last_name, rec.company_id, rec.company_name;
    END LOOP;
  END IF;

  -- Other non-client primaries (edge cases)
  SELECT count(*) INTO v_count
  FROM public.contacts c
  WHERE c.status NOT IN ('client')
    AND c.status IS DISTINCT FROM 'client'
    AND EXISTS (
      SELECT 1 FROM public.companies co WHERE co.primary_contact_id = c.id
    );
  RAISE NOTICE 'D.1: all non-client contacts who are company primary: %', v_count;

  -- D.2 info: clients who are not primary anywhere (data hygiene, not modified)
  SELECT count(*) INTO v_count
  FROM public.contacts c
  WHERE c.status = 'client'
    AND NOT EXISTS (
      SELECT 1 FROM public.companies co WHERE co.primary_contact_id = c.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.deals d WHERE d.contact_id = c.id
    );
  RAISE NOTICE 'D.2 info: client status contacts neither primary nor on a deal: % (not auto-demoted)', v_count;

  RAISE NOTICE 'D.2: demotion runs on primary_contact_id change (no bulk backfill)';

  IF NOT apply_changes THEN
    RAISE NOTICE 'DRY-RUN complete. Review counts, then set apply_changes := true.';
    RETURN;
  END IF;

  BEGIN
    -- D.1: promote from any status except already client
    CREATE OR REPLACE FUNCTION public.promote_contact_to_client(p_contact_id bigint)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
    BEGIN
      IF p_contact_id IS NULL THEN
        RETURN;
      END IF;

      UPDATE public.contacts c
      SET status = 'client'
      WHERE c.id = p_contact_id
        AND c.status IS DISTINCT FROM 'client';
    END;
    $fn$;

    COMMENT ON FUNCTION public.promote_contact_to_client(bigint) IS
      'Sets contacts.status to client when the person becomes a company primary (from any prior status).';

    -- D.1: contact change trigger — primary linkage before lead-only guard
    CREATE OR REPLACE FUNCTION public.promote_contact_to_client_on_contact_change()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM public.companies co WHERE co.primary_contact_id = new.id
      ) THEN
        new.status := 'client';
        RETURN new;
      END IF;

      IF new.status NOT IN ('lead', 'prospect') THEN
        RETURN new;
      END IF;

      IF new.lead_stage = 'won' AND new.company_id IS NOT NULL THEN
        new.status := 'client';
        RETURN new;
      END IF;

      IF EXISTS (
        SELECT 1 FROM public.deals d WHERE d.contact_id = new.id
      ) THEN
        new.status := 'client';
      END IF;

      RETURN new;
    END;
    $fn$;

    -- D.2: demote outgoing primary + promote incoming
    CREATE OR REPLACE FUNCTION public.sync_primary_contact_client_status()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
    BEGIN
      IF TG_OP = 'UPDATE'
         AND old.primary_contact_id IS NOT NULL
         AND new.primary_contact_id IS DISTINCT FROM old.primary_contact_id
      THEN
        IF NOT EXISTS (
          SELECT 1
          FROM public.companies co
          WHERE co.primary_contact_id = old.primary_contact_id
        ) THEN
          UPDATE public.contacts c
          SET status = 'contact_only'
          WHERE c.id = old.primary_contact_id
            AND c.status = 'client';
        END IF;
      END IF;

      IF new.primary_contact_id IS NOT NULL
         AND (
           TG_OP = 'INSERT'
           OR new.primary_contact_id IS DISTINCT FROM old.primary_contact_id
         )
      THEN
        PERFORM public.promote_contact_to_client(new.primary_contact_id);
      END IF;

      RETURN new;
    END;
    $fn$;

    -- Backfill D.1 for existing contact_only primaries
    UPDATE public.contacts c
    SET status = 'client'
    WHERE c.status = 'contact_only'
      AND EXISTS (
        SELECT 1 FROM public.companies co WHERE co.primary_contact_id = c.id
      );

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'APPLIED: promoted % contact_only primaries to client', v_count;

    RAISE NOTICE 'APPLIED: updated promote/demote triggers for primary contact lifecycle';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '05_extend_primary_contact_triggers failed: %', SQLERRM;
  END;
END $$;
