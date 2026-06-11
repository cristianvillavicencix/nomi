# Orphaned routes & dead components

## 1. Purpose

Documents routes registered in the React Router / react-admin shell that are **not linked from the primary sidebar** (`src/lbs/navigation.ts`) or user menu, plus components that **have no active route**. Each entry includes a **keep/delete recommendation** based on code references (grep, June 2026).

---

## 2. Files & components

| Item | Route / path | Primary file | Registered in |
|------|--------------|--------------|---------------|
| Reports | `/reports`, `/reports/web-agency-metrics` | `src/reports/ReportsPage.tsx` | `src/components/atomic-crm/root/CRM.tsx` |
| Proposals placeholder | `/proposals-placeholder` | `src/lbs/placeholders/` | `src/lbs/LbsCustomRoutes.tsx` |
| Contracts placeholder | `/contracts-placeholder` | `src/lbs/placeholders/` | `LbsCustomRoutes.tsx` |
| Tickets placeholder | `/tickets-placeholder` | `src/lbs/placeholders/` | `LbsCustomRoutes.tsx` |
| Import (redirected) | `/import` → `/` | `src/components/atomic-crm/misc/ImportPage.tsx` | `CRM.tsx` redirect |
| Signup (redirected) | `/sign-up/*` → `/login` | `src/components/atomic-crm/login/SignupPage.tsx` | `CRM.tsx` redirect |
| Confirmation required | *(no route)* | `ConfirmationRequired` in login folder | Unregistered |
| Contact quick view | *(no route)* | `src/components/atomic-crm/contacts/ContactQuickViewPage.tsx` | Unregistered |
| Standalone invoice show | *(no route)* | `src/lbs/billing/StandaloneInvoiceShowPage.tsx` | Unregistered |

---

## 3. Database

None — routing/UI only.

---

## 4. External services

None.

---

## 5. Connections to other modules

- **Reports** reads `report_web_agency_metrics` view via `WebAgencyMetricsReportPage`.
- Placeholders were rollout stubs when Proposals/Contracts/Tickets were behind feature flags (`LBS_PLACEHOLDER_MODULES` in `navigation.ts`).
- **ImportPage** tied to removed `/import` onboarding flow.
- **StandaloneInvoiceShowPage** superseded by `/billing?invoice=` workspace pattern.

---

## 6. Status: PARTIAL

Routes exist; several components are unreachable or redundant.

---

## 7. Per-item recommendations

| Item | Severity | Recommendation | Rationale |
|------|----------|----------------|-----------|
| **`/reports`** | MEDIUM | **KEEP** (wire nav) or **DELETE** route | Fully implemented `WebAgencyMetricsReportPage`; admin/sales_manager/user gated. Zero sidebar links — product decision: either add under Tools or remove route. |
| **`/reports/web-agency-metrics`** | LOW | **KEEP** with parent | Tab alias for same page; harmless if Reports kept. |
| **`/proposals-placeholder`** | LOW | **DELETE** | Real module at `/proposals`; no grep hits linking to placeholder path except route definition. |
| **`/contracts-placeholder`** | LOW | **DELETE** | Same as proposals placeholder. |
| **`/tickets-placeholder`** | LOW | **DELETE** | Same; `/tickets` is live in sidebar. |
| **`ImportPage` + `/import` redirect** | LOW | **DELETE** both | Route redirects home; `ImportFromJsonButton` may still exist in settings — keep import UX there, remove dead page. |
| **`SignupPage` + `/sign-up` redirect** | MEDIUM | **KEEP** code until signup product decision | Components exist; route intentionally disabled. Delete only if signup permanently off. |
| **`ContactQuickViewPage`** | LOW | **DELETE** | No route, no imports from other modules (verified grep). |
| **`StandaloneInvoiceShowPage`** | LOW | **DELETE** | Billing uses `ClientBillingPage` + `?invoice=`; no router entry. |

---

## 8. Approved decisions (fix phase queue)

**Recorded 2026-06-02.** No deletions during audit — execute in fix phase only.

| Item | Decision | Fix phase action |
|------|----------|------------------|
| **`/reports`** | **KEEP** | Add sidebar link under **Tools** (with Web Monitor / Forms discovery) |
| **`/proposals-placeholder`** | **DELETE** | Remove route + placeholder page |
| **`/contracts-placeholder`** | **DELETE** | Remove route + placeholder page |
| **`/tickets-placeholder`** | **DELETE** | Remove route + placeholder page |
| **`ImportPage` + `/import` redirect** | **DELETE** | Remove page and redirect; keep JSON import in Settings if still needed |
| **`SignupPage`** | **KEEP code** | Route stays disabled (`/sign-up/*` → `/login`); do not delete component |
| **`ContactQuickViewPage`** | **DELETE** | Remove unused component |
| **`StandaloneInvoiceShowPage`** | **DELETE** | Remove unused component; billing uses `?invoice=` workspace |

---

## 9. Broken connections

- None of these reference removed `person_id` columns.
- Placeholder pages may still import stale copy from `LBS_PLACEHOLDER_MODULES` — verify before delete.

---

## Edge functions

None used by this audit file.
