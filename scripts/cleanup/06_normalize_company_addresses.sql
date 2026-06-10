-- 06 — Normalize company address columns (street vs composed blob)
-- Database: qjglkywmqwqdoaboakao
--
-- GOAL: `address` = street line only; city/state_abbr/zipcode/country hold the rest.
--
-- BUCKETS (see scripts/cleanup/reports/generate_dry_run_06.mjs):
--   1. Multiline address blob → parse first line, populate columns
--   2. Single-line composed (Zoho import), empty columns → parse comma-separated US address
--   3. Embedded city with populated columns → trim address to street only
--   4. Backup restore — live lost columns that companies_pre_cleanup.json still has (e.g. 694)
--
-- ⚠️  DRY-RUN ONLY — run generate_dry_run_06.mjs for counts/examples; do not APPLY without approval.

-- ---------------------------------------------------------------------------
-- DRY-RUN: quick counts (subset — full logic in Node generator)
-- ---------------------------------------------------------------------------

SELECT count(*) AS multiline_address_count
FROM companies
WHERE address LIKE '%' || E'\n' || '%';

SELECT count(*) AS single_line_empty_columns_count
FROM companies
WHERE coalesce(trim(address), '') <> ''
  AND coalesce(trim(city), '') = ''
  AND coalesce(trim(state_abbr), '') = ''
  AND coalesce(trim(zipcode), '') = ''
  AND address NOT LIKE '%' || E'\n' || '%';

SELECT count(*) AS embedded_city_count
FROM companies
WHERE city IS NOT NULL
  AND trim(city) <> ''
  AND address ILIKE '%' || city || '%'
  AND address NOT LIKE '%' || E'\n' || '%';

-- ---------------------------------------------------------------------------
-- APPLY — executed via approved Node/SQL migration after dry-run sign-off
-- ---------------------------------------------------------------------------
-- Use scripts/cleanup/reports/generate_dry_run_06.mjs output + backup JSON.
-- Do not uncomment blind UPDATE here.
