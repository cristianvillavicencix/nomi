-- ============================================================================
-- 04_normalize_contact_status.sql
--
-- Why: contacts.status mixes LBS buckets (lead/client/contact), legacy
--      (warm/cold/new), and atomic-crm noteStatuses — filters and triggers
--      disagree on vocabulary.
--
-- Canonical (proposed): lead | prospect | client | contact_only | inactive
--
-- Proposed mapping (confirm before apply):
--   contact  -> contact_only  (224 rows)
--   lead     -> lead          (69)
--   client   -> client        (12)
--   warm     -> prospect      (2)
--   cold     -> prospect      (2)
--   new      -> lead          (1)
--
-- LBS filter impact (code updated to include legacy until this runs):
--   /leads    uses LBS_LEAD_STATUSES
--   /contacts uses LBS_CONTACT_STATUSES
--
-- Trigger impact on apply:
--   promote_contact_to_client() lead buckets -> ('lead', 'prospect')
--   promote_contact_to_client_on_contact_change() same
--
-- Usage: run as-is for dry-run. Set apply_changes := true to apply.
-- ============================================================================

DO $$
DECLARE
  apply_changes boolean := false;
  v_count integer;
  rec record;
BEGIN
  RAISE NOTICE '=== 04 normalize contact status (apply=%) ===', apply_changes;

  RAISE NOTICE 'Current status distribution:';
  FOR rec IN
    SELECT status, count(*) AS n
    FROM public.contacts
    GROUP BY status
    ORDER BY n DESC
  LOOP
    RAISE NOTICE '  current status=% count=%', coalesce(rec.status, '(null)'), rec.n;
  END LOOP;

  RAISE NOTICE 'Proposed mapping (current -> canonical):';
  FOR rec IN
    SELECT
      coalesce(c.status, '(null)') AS current_status,
      CASE coalesce(c.status, '')
        WHEN 'contact' THEN 'contact_only'
        WHEN 'warm' THEN 'prospect'
        WHEN 'cold' THEN 'prospect'
        WHEN 'new' THEN 'lead'
        WHEN 'lead' THEN 'lead'
        WHEN 'prospect' THEN 'prospect'
        WHEN 'client' THEN 'client'
        WHEN 'inactive' THEN 'inactive'
        WHEN 'contact_only' THEN 'contact_only'
        ELSE 'UNMAPPED'
      END AS proposed_status,
      count(*) AS n
    FROM public.contacts c
    GROUP BY 1, 2
    ORDER BY n DESC
  LOOP
    RAISE NOTICE '  % -> % (% rows)', rec.current_status, rec.proposed_status, rec.n;
  END LOOP;

  RAISE NOTICE 'Trigger check: promote_contact_to_client currently promotes from (lead,warm,cold,prospect)';
  RAISE NOTICE 'After apply: will promote from (lead,prospect) only';

  SELECT count(*) INTO v_count
  FROM public.contacts c
  WHERE coalesce(c.status, '') NOT IN (
    'contact','warm','cold','new','lead','prospect','client','inactive','contact_only'
  );
  RAISE NOTICE 'Unmapped status values (need manual decision): %', v_count;

  IF NOT apply_changes THEN
    RAISE NOTICE 'DRY-RUN complete. Confirm mapping with team, then set apply_changes := true.';
    RETURN;
  END IF;

  BEGIN
    UPDATE public.contacts
    SET status = CASE coalesce(status, '')
      WHEN 'contact' THEN 'contact_only'
      WHEN 'warm' THEN 'prospect'
      WHEN 'cold' THEN 'prospect'
      WHEN 'new' THEN 'lead'
      ELSE status
    END
    WHERE status IN ('contact', 'warm', 'cold', 'new');

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'APPLIED: remapped status on % contacts', v_count;

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
        AND c.status IN ('lead', 'prospect');
    END;
    $fn$;

    CREATE OR REPLACE FUNCTION public.promote_contact_to_client_on_contact_change()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
    BEGIN
      IF new.status NOT IN ('lead', 'prospect') THEN
        RETURN new;
      END IF;

      IF new.lead_stage = 'won' AND new.company_id IS NOT NULL THEN
        new.status := 'client';
        RETURN new;
      END IF;

      IF EXISTS (
        SELECT 1 FROM public.companies co WHERE co.primary_contact_id = new.id
      ) THEN
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

    RAISE NOTICE 'APPLIED: updated promotion triggers for canonical status vocabulary';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '04_normalize_contact_status failed: %', SQLERRM;
  END;
END $$;
