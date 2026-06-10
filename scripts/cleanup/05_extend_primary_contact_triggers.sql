-- ============================================================================
-- 05_extend_primary_contact_triggers.sql
--
-- Phase 3 Block D: primary contact promotion / demotion (HYBRID policy)
--
-- Triggers (broad, future assignments):
--   D.1: When assigned companies.primary_contact_id, promote to `client`
--        from ANY non-client status (including contact_only).
--   D.2: When replaced as primary, demote outgoing to `contact_only` if not
--        primary on any other company.
--
-- Backfill (restricted):
--   Only contact_only primaries whose company has activity_total > 0
--   (deals, proposals, or client_invoices). Remaining contact_only primaries
--   stay contact_only until a future primary assignment or new activity.
--
-- Usage: run as-is for dry-run. Set apply_changes := true to apply.
-- ============================================================================

DO $$
DECLARE
  apply_changes boolean := false;
  v_count integer;
  v_backfill_count integer;
  rec record;
BEGIN
  RAISE NOTICE '=== 05 extend primary contact triggers (hybrid, apply=%) ===', apply_changes;

  -- All contact_only primaries (informational)
  SELECT count(*) INTO v_count
  FROM public.contacts c
  WHERE c.status = 'contact_only'
    AND EXISTS (
      SELECT 1
      FROM public.companies co
      WHERE co.primary_contact_id = c.id
    );
  RAISE NOTICE 'Info: contact_only contacts who are company primary (total): %', v_count;
  RAISE NOTICE 'Detail: scripts/cleanup/05_dry_run_promotable_companies.sql';

  -- Hybrid backfill target: activity only
  SELECT count(*) INTO v_backfill_count
  FROM public.contacts c
  WHERE c.status = 'contact_only'
    AND EXISTS (
      SELECT 1
      FROM public.companies co
      WHERE co.primary_contact_id = c.id
        AND (
          EXISTS (SELECT 1 FROM public.deals d WHERE d.company_id = co.id)
          OR EXISTS (SELECT 1 FROM public.proposals p WHERE p.company_id = co.id)
          OR EXISTS (
            SELECT 1 FROM public.client_invoices i WHERE i.company_id = co.id
          )
        )
    );
  RAISE NOTICE 'Backfill UPDATE will affect % contact row(s) (activity_total > 0 only)', v_backfill_count;

  IF v_backfill_count > 0 THEN
    RAISE NOTICE 'Backfill targets:';
    FOR rec IN
      SELECT
        c.id AS contact_id,
        trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')) AS contact_name,
        c.status,
        co.id AS company_id,
        co.name AS company_name,
        coalesce(co.sector, '') AS sector,
        (
          SELECT count(*)::int FROM public.deals d WHERE d.company_id = co.id
        ) AS deals_count,
        (
          SELECT count(*)::int FROM public.proposals p WHERE p.company_id = co.id
        ) AS proposals_count,
        (
          SELECT count(*)::int FROM public.client_invoices i WHERE i.company_id = co.id
        ) AS invoices_count
      FROM public.contacts c
      JOIN public.companies co ON co.primary_contact_id = c.id
      WHERE c.status = 'contact_only'
        AND (
          EXISTS (SELECT 1 FROM public.deals d WHERE d.company_id = co.id)
          OR EXISTS (SELECT 1 FROM public.proposals p WHERE p.company_id = co.id)
          OR EXISTS (
            SELECT 1 FROM public.client_invoices i WHERE i.company_id = co.id
          )
        )
      ORDER BY co.id
    LOOP
      RAISE NOTICE '  contact_id=% name=% company_id=% company=% sector=% deals=% proposals=% invoices=%',
        rec.contact_id, rec.contact_name, rec.company_id, rec.company_name, rec.sector,
        rec.deals_count, rec.proposals_count, rec.invoices_count;
    END LOOP;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.contacts c
  WHERE c.status = 'contact_only'
    AND EXISTS (SELECT 1 FROM public.companies co WHERE co.primary_contact_id = c.id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.companies co
      WHERE co.primary_contact_id = c.id
        AND (
          EXISTS (SELECT 1 FROM public.deals d WHERE d.company_id = co.id)
          OR EXISTS (SELECT 1 FROM public.proposals p WHERE p.company_id = co.id)
          OR EXISTS (
            SELECT 1 FROM public.client_invoices i WHERE i.company_id = co.id
          )
        )
    );
  RAISE NOTICE 'Intentionally unchanged (contact_only primary, no activity): %', v_count;

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
    RAISE NOTICE 'DRY-RUN complete. Backfill rows=%. Set apply_changes := true to apply.', v_backfill_count;
    RETURN;
  END IF;

  BEGIN
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

    -- Hybrid backfill: activity only (not all contact_only primaries)
    UPDATE public.contacts c
    SET status = 'client'
    WHERE c.status = 'contact_only'
      AND EXISTS (
        SELECT 1
        FROM public.companies co
        WHERE co.primary_contact_id = c.id
          AND (
            EXISTS (SELECT 1 FROM public.deals d WHERE d.company_id = co.id)
            OR EXISTS (SELECT 1 FROM public.proposals p WHERE p.company_id = co.id)
            OR EXISTS (
              SELECT 1 FROM public.client_invoices i WHERE i.company_id = co.id
            )
          )
      );

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'APPLIED: hybrid backfill promoted % contact(s) to client', v_count;

    IF v_count <> v_backfill_count THEN
      RAISE EXCEPTION 'Backfill row count mismatch: expected %, got %', v_backfill_count, v_count;
    END IF;

    RAISE NOTICE 'APPLIED: updated promote/demote triggers for primary contact lifecycle';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '05_extend_primary_contact_triggers failed: %', SQLERRM;
  END;
END $$;
