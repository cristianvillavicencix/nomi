# Agent Rules — Nomi CRM

**Date:** 2026-06-02 (from full audit)  
**Audience:** Cursor / Claude / Codex agents working in this repo  
**Canonical dev guide:** [`AGENTS.md`](../../AGENTS.md) at repo root

---

## 1. Audit context

A full READ-ONLY audit completed June 2026. Before large changes, read:

| Doc | When |
|-----|------|
| [`docs/audit/00-OVERVIEW.md`](./00-OVERVIEW.md) | Executive summary, fix plan, diagrams |
| [`docs/audit/20-data-provider.md`](./20-data-provider.md) | Filters, getOne, PostgREST |
| [`docs/audit/19-orphaned-routes.md`](./19-orphaned-routes.md) | Route keep/delete decisions |
| Module file `docs/audit/NN-*.md` | Domain-specific edge functions & issues |

**Fix phase:** P0–P5 plan in `00-OVERVIEW.md`. Do not delete orphaned routes/components until fix-phase PR is approved.

---

## 2. Language

- **English** for all UI copy, code comments, commits, PRs, and repo docs.
- User chat may be Spanish; product strings stay English (see `.cursor/rules/english-ui.mdc`).

---

## 3. Data layer rules (mandatory)

### Filter operators (Option A — confirmed)

- Use **positive `@in` allow-lists** only (`statusInFilter()`, `openDealFilters.ts`).
- **Never** use `@nin` or `@not.in` — PostgREST rejects `nin`; not mapped in production.
- Use `@eq`, `@neq`, `@cs`, `@is`, `@not.is`, `@or`, `@ilike` per `20-data-provider.md`.
- For `@ilike`, do **not** wrap values in manual `%` — `ra-data-postgrest` adds wildcards.

### getOne / empty ids

- Guard queries with `isValidRecordId()` before `useGetOne` / `getOne`.
- Prefer `maybeSingle()` for singleton rows under RLS (`configuration`, summary views).
- Contacts/companies/monitored_websites already override `getOne` in dataProvider.

### Summary views

- List/getOne for `companies`, `contacts`, `monitored_websites` → `*_summary` views automatically.
- Filters must use columns present on the view.

---

## 4. Supabase & deployment

- **Default:** hosted Supabase (`VITE_SUPABASE_URL` in `.env.development`), not local Docker.
- Migrations: `npx supabase db push --project-ref <ref>` — verify pg_cron jobs after deploy.
- Edge functions: `supabase functions deploy <name> --project-ref <ref>`.
- Never set hosted `SB_JWT_ISSUER` to `http://127.0.0.1:54321/auth/v1`.
- Web audit worker: **Cloud Run primary** (`workers/web-audit/CLOUD_RUN.md`); Fly.io legacy only.

---

## 5. Edge functions & crons

| Trigger | Functions |
|---------|-----------|
| pg_cron (live) | `website_monitor_run`, `website_audit_schedule`, invoice reminders/charges |
| Vercel cron | `process_scheduled_payments`, `process_scheduled_client_invoices` |
| Fix phase queue | `process_missed_invoice_payment_receipts` (daily pg_cron) |
| DORMANT — do not wire | `send_calendar_reminders`, WhatsApp/voice stubs |

**DORMANT (not deletion candidates):** `send_whatsapp`, `whatsapp_inbound`, `voice_token`, `voice_status_webhook` — pending Meta appeal.

---

## 6. Code change discipline

1. **Minimize scope** — smallest correct diff; match surrounding conventions.
2. **No drive-by refactors** during bug fixes.
3. **Imports** — verify UI components (`Badge`, `Button`, `MoneyText`) are imported (batch 1/2 crash pattern).
4. **Commits** — only when user asks; English messages; no `--no-verify` unless requested.
5. **Do not delete** audit-queued orphans until fix-phase approval.

---

## 7. Testing before PR

```bash
make typecheck
make lint
```

Manual smoke: affected list/show pages, especially filters on client/contact sidebars (uses `@in`, `@cs`).

---

## 8. Restructure

Folder moves per [`RESTRUCTURE-PROPOSAL.md`](./RESTRUCTURE-PROPOSAL.md) — **after** P0–P3 fixes. Start with dataProvider module split (Phase B) if approved.

---

## 9. Quick module map

| Path | Domain |
|------|--------|
| `src/components/atomic-crm/` | Generic CRM shell, contacts, deals, tasks |
| `src/lbs/` | LBS product modules |
| `src/components/atomic-crm/providers/supabase/dataProvider.ts` | All backend calls |
| `supabase/functions/` | Edge functions |
| `workers/web-audit/` | Lighthouse worker |

---

## 10. Naming (Deals vs Project)

**Approved 2026-06-02.** During restructure only — **no renames in fix phase.**

- **Deal** — single term for the sales pipeline in nav, filters, and copy.
- **Project** — only inside delivery tabs of a **won** deal (`ProjectWorkspaceTabs`, brief/launch/delivery).

See [`RESTRUCTURE-PROPOSAL.md`](./RESTRUCTURE-PROPOSAL.md) §6.

---

## 11. Related rules

- [`.cursor/rules/english-ui.mdc`](../../.cursor/rules/english-ui.mdc)
- [`AGENTS.md`](../../AGENTS.md) — setup, architecture, env vars
- [`CLAUDE.md`](../../CLAUDE.md) — pointer to AGENTS.md + audit docs
