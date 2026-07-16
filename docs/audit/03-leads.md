# Leads

> **UI entry superseded (2026-07):** With `VITE_ACCOUNTS_HUB=1`, the staff entry is **Accounts → Board** (`/accounts?view=board`). `/leads` redirects there. Tables and write paths are unchanged. See `docs/plans/00-accounts-hub-OVERVIEW.md`.

## 1. Purpose

Pre-client pipeline for contacts with `status` in lead statuses (`lead`, `prospect`, etc.). Kanban and table views at `/leads`, lead detail at `/leads/:id/show`, creation via dialog/page. **Convert to client** promotes a lead to `status=client`, links/creates a company, optionally creates a **closed-won** deal. **Anti-Olvido** is the in-app follow-up radar using `lead_stage`, `snooze_until`, and deal-stage sync triggers (not a cron).

## 2. Files & components

| Kind | Path |
|------|------|
| List | `src/lbs/leads/LeadsListPage.tsx` — table + kanban toggle |
| Kanban | `src/lbs/leads/LeadsKanban.tsx` |
| Show | `src/lbs/leads/LeadShowPage.tsx`, `LeadShowContent.tsx`, sidebars |
| Create | `src/lbs/leads/NewLeadDialog.tsx`, `LeadCreatePage.tsx` |
| Convert | `src/lbs/leads/ConvertLeadButton.tsx`, kanban won-drop in `LeadsKanban.tsx` |
| Stage | `applyLeadStageChange.ts`, `LeadStageChangeDialog.tsx`, `leadStages.ts` |
| Follow-up | `leadFollowUpUtils.ts`, `LeadPipelinePanel.tsx`, `LeadActivityPanel.tsx` |
| Routing | `getLeadShowPath`, `getLeadsListPath` in `src/lbs/routing.ts` |
| Data | `dataProvider.convertLeadToClient`, `buildCreateLeadPayload.ts` |

## 3. Database

| Table | Key columns / notes |
|-------|---------------------|
| `contacts` | `status`, `lead_stage`, `snooze_until`, `company_id`, `interested_service`, `lead_value_estimate`, `org_id` |
| `companies` | Created/linked on convert; `primary_contact_id` |
| `deals` | Optional insert on convert (`stage=closed_won`, `lifecycle_phase=closed`, `converted_from_contact_id`) |

**Triggers (documented):** `trg_sync_deal_to_lead_stage` — deal stage changes update contact `lead_stage` / `snooze_until` (`PLAN_FASE_1.md`, migration `20260711120000_fase1_deals_activation.sql`).

**RLS:** `contacts` / `companies` / `deals` org-scoped; convert uses service role paths inside `dataProvider` with user JWT for reads.

**Orphan FK check (SQL — not executed; no DB access in audit):**

```sql
SELECT count(*) FROM contacts c
WHERE c.status IN ('lead','prospect') AND c.company_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM companies co WHERE co.id = c.company_id);
```

## 4. External services

| Service | Usage |
|---------|--------|
| Google Places | Lead/company forms via `VITE_GOOGLE_PLACES_API_KEY` + `google_places` edge proxy |
| Zoho import | Settings → Data tab → `zoho_oneshot_import` (creates leads) |

## 5. Connections to other modules

| Direction | Target | Flow |
|-----------|--------|------|
| Writes | Companies | Convert lead → company create/link |
| Writes | Contacts | `status` → `client` |
| Writes | Deals | Optional closed-won deal on convert |
| Reads | Deals | Kanban won column triggers convert |
| Settings | Data import | Zoho → contacts as leads |

## 6. Edge functions used by this module

| Function | Invoked from | Role |
|----------|--------------|------|
| *(none direct)* | Leads UI uses `dataProvider.convertLeadToClient` → Supabase client insert | Deal/company/contact writes |
| `google_places` | Indirect via `src/lib/googlePlaces/edgeProxy.ts` | Address/business autocomplete on lead forms |
| `zoho_oneshot_import` | Settings only (`DataImportSection.tsx`) | Bulk lead import |

**Not used by Leads UI:** `merge_contacts` (Contacts/Settings path).

## 7. Status: PARTIAL

Core list/kanban/show work. **ConvertLeadButton** had missing `Button` import (runtime crash) — fixed in working tree; verify deployed build.

## 8. Issues found

| Severity | Location | User impact | Root cause |
|----------|----------|-------------|------------|
| CRITICAL | `ConvertLeadButton.tsx:108` | Convert button crashes page | Missing `import { Button } from "@/components/ui/button"` |
| HIGH | `LeadsKanban.tsx` won drop | Same convert path as button | Shares `convertLeadToClient` — OK once import fixed |
| MEDIUM | `lead_stage@nin` in legacy filters | Filter cleanup only | `LeadsListPage.tsx` `LEGACY_FOLLOW_UP_FILTER_KEYS` — removed from UI but may persist in localStorage |
| LOW | Mobile | No `/leads` in mobile bottom nav | By design in `MobileNavigation.tsx` |
| LOW | Anti-Olvido | Confusion vs cron | Documented as in-app logic, not scheduled job |

## 9. Broken connections

- `convertLeadToClient` uses shared `buildDealInsertRecord` (`src/lbs/deals/createDeal.ts`) — behavior unchanged (still `closed_won`).
- No active `person_id` column on contacts; task `person_id` FK is separate legacy on `task_assignees`.
- FakeRest `convertLeadToClient` does **not** create deals (Supabase-only deal insert) — demo mode divergence.
