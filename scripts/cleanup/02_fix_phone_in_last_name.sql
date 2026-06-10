-- ============================================================================
-- 02_fix_phone_in_last_name.sql
--
-- Why: Some contacts have phone numbers stored in last_name (import/paste).
--      Moves digits to phone_jsonb (type Work) and clears last_name.
--
-- Idempotent: skips if normalized number already exists in phone_jsonb.
-- US numbers formatted as (XXX) XXX-XXXX when 10 or 11 digits.
--
-- Usage: run as-is for dry-run. Set apply_changes := true to apply.
-- ============================================================================

DO $$
DECLARE
  apply_changes boolean := false;
  v_count integer;
  rec record;
BEGIN
  RAISE NOTICE '=== 02 fix phone in last_name (apply=%) ===', apply_changes;

  SELECT count(*) INTO v_count
  FROM public.contacts c
  WHERE c.last_name ~ '^[\d\s\-\(\)\+\.]{7,}$'
     OR c.last_name ~ '^\(\d{3}\)'
     OR c.last_name ~ '^\d{3}[\-\.]?\d{3}[\-\.]?\d{4}$'
     OR c.last_name ~ '^\+\d{10,15}$';
  RAISE NOTICE 'Contacts matching phone-like last_name pattern: %', v_count;

  FOR rec IN
    SELECT
      c.id,
      c.first_name,
      c.last_name,
      c.company_id,
      c.status,
      c.phone_jsonb
    FROM public.contacts c
    WHERE c.last_name ~ '^[\d\s\-\(\)\+\.]{7,}$'
       OR c.last_name ~ '^\(\d{3}\)'
       OR c.last_name ~ '^\d{3}[\-\.]?\d{3}[\-\.]?\d{4}$'
       OR c.last_name ~ '^\+\d{10,15}$'
    ORDER BY c.id
  LOOP
    RAISE NOTICE '  MATCH id=% first=% last=% company_id=% status=% phones=%',
      rec.id, rec.first_name, rec.last_name, rec.company_id, rec.status, rec.phone_jsonb;
  END LOOP;

  IF NOT apply_changes THEN
    RAISE NOTICE 'DRY-RUN complete. Set apply_changes := true to apply.';
    RETURN;
  END IF;

  BEGIN
    WITH matches AS (
      SELECT
        c.id,
        c.last_name AS raw_phone,
        regexp_replace(c.last_name, '[^0-9]', '', 'g') AS digits
      FROM public.contacts c
      WHERE c.last_name ~ '^[\d\s\-\(\)\+\.]{7,}$'
         OR c.last_name ~ '^\(\d{3}\)'
         OR c.last_name ~ '^\d{3}[\-\.]?\d{3}[\-\.]?\d{4}$'
         OR c.last_name ~ '^\+\d{10,15}$'
    ),
    normalized AS (
      SELECT
        m.id,
        m.raw_phone,
        CASE
          WHEN length(m.digits) = 11 AND left(m.digits, 1) = '1' THEN
            '(' || substring(m.digits, 2, 3) || ') ' ||
            substring(m.digits, 5, 3) || '-' || substring(m.digits, 8, 4)
          WHEN length(m.digits) = 10 THEN
            '(' || substring(m.digits, 1, 3) || ') ' ||
            substring(m.digits, 4, 3) || '-' || substring(m.digits, 7, 4)
          ELSE m.raw_phone
        END AS formatted_number,
        m.digits
      FROM matches m
    ),
    to_update AS (
      SELECT
        n.id,
        n.formatted_number,
        n.digits
      FROM normalized n
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.contacts c2,
             jsonb_array_elements(coalesce(c2.phone_jsonb, '[]'::jsonb)) elem
        WHERE c2.id = n.id
          AND regexp_replace(coalesce(elem->>'number', ''), '[^0-9]', '', 'g') = n.digits
      )
    )
    UPDATE public.contacts c
    SET
      phone_jsonb = coalesce(c.phone_jsonb, '[]'::jsonb) ||
        jsonb_build_array(jsonb_build_object('number', u.formatted_number, 'type', 'Work')),
      last_name = ''
    FROM to_update u
    WHERE c.id = u.id;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'APPLIED: updated % contacts (phone moved, last_name cleared)', v_count;

    -- Clear last_name even when phone already present
    UPDATE public.contacts c
    SET last_name = ''
    WHERE (c.last_name ~ '^[\d\s\-\(\)\+\.]{7,}$'
       OR c.last_name ~ '^\(\d{3}\)'
       OR c.last_name ~ '^\d{3}[\-\.]?\d{3}[\-\.]?\d{4}$'
       OR c.last_name ~ '^\+\d{10,15}$')
      AND c.last_name <> '';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'APPLIED: cleared last_name on % phone-like rows total', v_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '02_fix_phone_in_last_name failed: %', SQLERRM;
  END;
END $$;
