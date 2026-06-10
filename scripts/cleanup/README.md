# Clients module data cleanup scripts

**Target:** hosted Supabase `qjglkywmqwqdoaboakao` (production).

All scripts default to **dry-run**. Do not set `apply_changes := true` until you review the report.

## Run dry-run (read-only report)

```bash
npx supabase db query --linked --agent=no -f scripts/cleanup/01_backfill_primary_contact_id.sql
npx supabase db query --linked --agent=no -f scripts/cleanup/02_fix_phone_in_last_name.sql
npx supabase db query --linked --agent=no -f scripts/cleanup/03_normalize_company_sector.sql
npx supabase db query --linked --agent=no -f scripts/cleanup/04_normalize_contact_status.sql
npx supabase db query --linked --agent=no -f scripts/cleanup/05_extend_primary_contact_triggers.sql
```

## Apply (after explicit approval)

1. Open each script and set `apply_changes boolean := true` in the `DO` block.
2. Re-run with the same command.

Each apply section runs inside a transaction and rolls back if `apply_changes` is false.

## Manual review

- **01:** Lists companies with zero contacts (not modified by script).
- **03:** Values flagged `NEEDS_MANUAL_MAP` require your mapping before apply.
- **04:** Review proposed status mapping counts before apply; updates DB triggers on apply.

Dry-run reports are also saved under `scripts/cleanup/reports/` after agent runs.
