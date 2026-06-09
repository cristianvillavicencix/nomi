# NOMI_DEPRECATION_MAP.md

**Scope:** Code paths where `isLbsMode() === false` (includes classic Nomi payroll/people stack **and** `VITE_PRODUCT_MODE=contractor` builds).  
**Goal:** Map what can be removed once LBS is the only product mode. **No deletions in this document — audit only.**

**Product mode today** (`src/lbs/productMode.ts`):

| `VITE_PRODUCT_MODE` | `isLbsMode()` | Behavior |
|---------------------|---------------|----------|
| unset / `lbs` | `true` | LBS CRM (target) |
| `contractor` | `false` | Contractor deal UI + classic resources; **LbsCustomRoutes returns `null`** |

---

## A) `<Resource>` only registered when `!isLbsMode()` (`CRM.tsx`)

| Resource | CRM.tsx lines (approx.) | Why non-LBS | LBS cross-dependency |
|----------|---------------------------|-------------|----------------------|
| `people` | 518 | HR/payroll team roster UI (`src/people/`) | **YES** — LBS reads `people` for commissions & calendar (`dealCommissionAutomation.ts`, `CommissionsTab.tsx`, `useCalendarEvents.ts`, `CalendarReminderDialog.tsx`). **Cannot remove table or dataProvider support without migration.** |
| `time_entries` | 519 | Hour logging / payroll input (`src/timeEntries/`) | **NO** direct LBS UI imports found |
| `payments` | 520 | Internal payroll payment runs (`src/payments/`) | **NO** — LBS “Payments” tabs use `deal_client_payments`, not this resource |
| `payment_lines` | 521 | Line items on payroll `payments` | **NO** |
| `payroll_runs` | 522 | Payroll batch processing (`src/payrollRuns/`) | **NO** |
| `payroll_run_lines` | 523 | Payroll run detail lines | **NO** |
| `employee_loans` | 524 | Employee advances (`src/loans/`) | **NO** |
| `employee_loan_deductions` | 525 | Loan deduction history | **NO** |
| `employee_pto_adjustments` | 526 | PTO adjustments | **NO** |
| `deal_subcontractor_entries` | 584 | Contractor cost tracking on deals | **Partial** — listed in `lbsAgencyProjectModel.ts` as contractor-only hidden resource; **not** registered in LBS `Resource` block. `dataProvider.ts` still references it for contractor flows |

**Note:** LBS mode registers many resources instead (proposals, client_invoices, forms-v2, etc.) — see `CRM.tsx` ~529–576. Those are **in scope**, not deprecated.

---

## B) Folders / files primarily serving `!isLbsMode()`

### B.1 — Safe candidates (no imports from `src/lbs/**`)

| Path | Why non-LBS | LBS imports it? |
|------|-------------|-----------------|
| `src/timeEntries/` (9 files) | Hours list/create/edit, payroll queue UI | **NO** from `src/lbs/**` (only internal + `contractor/deals/ContractorDealShow.tsx`) |
| `src/payments/` (11 files) | Payroll payment register, receipts, wizard | **NO** from `src/lbs/**` |
| `src/payrollRuns/` (12 files) | Payroll runs CRUD, approved-hours review | **NO** from `src/lbs/**` |
| `src/loans/` (8 files) | Employee loan module | **NO** from `src/lbs/**` (except `PeopleShow.tsx` internal) |

### B.2 — Partial / shared (do **not** delete whole folder)

| Path | Why non-LBS | LBS cross-dependency |
|------|-------------|----------------------|
| `src/people/` (19 files) | People quick-nav UI, employee/salesperson/subcontractor CRUD | **YES** — `people` **table/resource** used by LBS commissions & calendar (see A). UI pages are non-LBS; data layer is not. |
| `src/reports/` (8 files) | Finance reports (payroll, labor, commissions, profitability) | **Partial** — LBS uses `WebAgencyMetricsReportPage.tsx` + LBS branch in `ReportsPage.tsx`. Other 4 report pages are non-LBS only. |
| `src/platform/` (11 files) | SaaS operator console `/sas/*`, Stripe seat billing | **Partial** — `billingDefaults.ts`, `inviteBillingGate.ts` imported by LBS `UsersSettingsSection.tsx`; `platformConsolePaths.ts` imported by `authProvider.ts` (always loaded). Console pages (`PlatformApp`, etc.) are non-LBS only. |
| `src/components/atomic-crm/providers/fakerest/dataProvider.ts` | Demo provider | Imports `@/loans/helpers` — touch if removing loans module |

### B.3 — Contractor build (`VITE_PRODUCT_MODE=contractor`, also `!isLbsMode()`)

| Path | Why non-LBS | LBS cross-dependency |
|------|-------------|----------------------|
| `src/contractor/deals/ContractorDealShow.tsx` | Full contractor deal show (~4.5k LOC) | **NO** from `src/lbs/**`; loaded only when `VITE_PRODUCT_MODE === "contractor"` via `DealShow.tsx` |
| `src/components/atomic-crm/deals/DealInputsContractor.tsx` | Contractor deal form fields | Loaded via `DealInputs.tsx` when contractor build |
| `src/components/atomic-crm/deals/DealInputs.tsx` | Lazy switch LBS vs contractor inputs | **Shared** — keep shell; remove contractor lazy branch later |

### B.4 — Platform console (non-LBS routes)

| Path | Why non-LBS | LBS cross-dependency |
|------|-------------|----------------------|
| `src/platform/PlatformApp.tsx` | `/sas/*` layout shell | **NO** |
| `src/platform/PlatformEmpresasPage.tsx` | Org list for operators | **NO** |
| `src/platform/PlatformEmpresaDetailPage.tsx` | Org detail | **NO** |
| `src/platform/PlatafformRedirect.tsx` | Legacy URL redirects | **NO** (LBS redirects `/sas` → `/`) |
| `src/platform/PlatformLayout.tsx`, `PlatformPage.tsx`, `PlatformChangePasswordDialog.tsx`, `usePlatformOperator.ts` | Console chrome | **NO** |
| `src/platform/billingDefaults.ts` | Default seat price constant | **YES** — `UsersSettingsSection.tsx` (LBS) |
| `src/platform/inviteBillingGate.ts` | Skip invite billing flag | **YES** — `UsersSettingsSection.tsx` (LBS) |
| `src/platform/platformConsolePaths.ts` | Detect `/sas` paths for auth | **YES** — `authProvider.ts` (always) |

### B.5 — Demo / legacy entry (non-LBS)

| Path | Why non-LBS | LBS cross-dependency |
|------|-------------|----------------------|
| `demo/App.tsx`, `demo/main.tsx` | Separate Vite demo entry (`vite.demo.config`) | **NO** |
| `src/components/atomic-crm/misc/ImportPage.tsx` | JSON import; menu only when `!isLbsMode()` | **NO** (LBS redirects `/import` → `/`) |

### B.6 — Grep summary (`from('…')` in `src/`)

Per requested patterns, **zero matches** (app uses react-admin resources / PostgREST, not inline `supabase.from('…')` in frontend). Cross-import check used `@/people`, `@/payments`, etc. instead.

---

## C) Routes & UI branches dead after removing `!isLbsMode()`

### C.1 — `CRM.tsx` `CustomRoutes noLayout` (~293–323)

| Route / branch | Condition | Effect when removed |
|----------------|-----------|---------------------|
| `/platafform`, `/platafform/*` | LBS: redirect → `/` | Already noop in LBS |
| `/platform`, `/platform/*` | LBS: redirect → `/` | Already noop in LBS |
| `/sas`, `/sas/*` | LBS: redirect → `/` | Already noop in LBS |
| `/sas/*` → `PlatformApp` (empresas) | **Only `!isLbsMode()`** | Entire SaaS console gone |
| `PlatafformToSasRedirect`, `OldPlatformToSasRedirect` | **Only `!isLbsMode()`** | Legacy redirects gone |

Public LBS routes in same block (`renderLbsPublicFormRoute`, portal, proposal preview) stay — gated by `isLbsMode()`.

### C.2 — `CRM.tsx` `CustomRoutes` with layout (~326–513)

| Route / branch | Condition | Notes |
|----------------|-----------|-------|
| `/import` → `ImportPage` | Redirect to `/` when LBS | Already blocked in LBS |
| `/contacts/:id/show` → `ContactQuickViewPage` | `!isLbsMode()` | LBS uses `/contacts/:id/show` → `LbsContactShowPage` via resource |
| `/companies/:id/show(/:tab)` → `CompanyQuickViewPage` | `!isLbsMode()` | LBS redirects `/companies/*` → `/clients/*` |
| `/people/employees/*` (×3) | `!isLbsMode()` | People quick-nav |
| `/people/salespeople/*` (×3) | `!isLbsMode()` | People quick-nav |
| `/people/subcontractors/*` (×3) | `!isLbsMode()` | People quick-nav |
| `/reports/*` (5 routes) | Always registered | LBS uses `/reports` → `WebAgencyMetricsReportPage` only; other tab paths unused in LBS |
| `/projects` → `/deals` | Always | Keep |
| `renderLbsCustomRoutes()` | Returns **`null` if `!isLbsMode()`** | **Contractor mode loses all LBS routes today** |
| `/time_entries/*`, `/payroll_runs/*`, `/payments/*`, `/employee_loans/*`, `/people/*` → `/` | **`isLbsMode()` redirects** | Already blocked in LBS production |

### C.3 — `CRM.tsx` `<Resource>` blocks

| Block | Condition | Contents |
|-------|-----------|----------|
| Payroll / people resources | `!isLbsMode()` | See section A |
| `deal_subcontractor_entries`, duplicate `deal_expenses`, etc. | `!isLbsMode()` | Contractor/classic deal financials |
| LBS resources | `isLbsMode()` | proposals, billing, forms-v2, messages, … |

### C.4 — `SidebarLayout.tsx` (~281–436)

| Block | Condition | Contents |
|-------|-----------|----------|
| `LbsSidebarNav` + logo header | `isLbsMode()` | **Keep** |
| Inline sidebar: Dashboard, CRM (Projects/Companies/Contacts), Time & pay (Hours/Payroll/Loans), Team (People), Reports | **`!isLbsMode()`** | Entire second sidebar — **remove branch**, keep LBS branch only |

### C.5 — Other `!isLbsMode()` UI (cleanup later, not full folders)

| File | What |
|------|------|
| `src/components/atomic-crm/layout/Header.tsx` | Top nav with Time & pay dropdown (~22–36, 109–112) vs LBS header |
| `src/components/atomic-crm/layout/UserMenuItems.tsx` | Settings + Import menu when `!isLbsMode()` |
| `src/components/atomic-crm/layout/MobileNavigation.tsx` | `/companies`, `/people` path detection |
| `src/components/atomic-crm/settings/SettingsPage.tsx` | `payments` settings tab when `!isLbsMode()` (~479+) |
| `src/components/atomic-crm/root/defaultConfiguration.ts` | `contractorDealStages`, `contractorNoteStatuses` when `!isLbsMode()` |
| `src/components/atomic-crm/deals/DealEmpty.tsx` | Link to `/contacts/create` |
| `src/components/atomic-crm/dashboard/Dashboard.tsx` | `TasksList` vs `LbsDashboardTasks` |
| `src/components/atomic-crm/dashboard/HotContacts.tsx` | `/contacts/create` link |
| `src/reports/ReportsPage.tsx` | Non-LBS tab shell (~120–185) |

### C.6 — `LbsCustomRoutes.tsx` early return

```ts
if (!isLbsMode()) {
  return null;
}
```

Removing `!isLbsMode()` as a supported state implies **`renderLbsCustomRoutes` always runs** (and contractor mode must be deleted or redefined separately).

---

## D) Database tables primarily tied to non-LBS (list only — no drop proposal)

**Payroll / time / internal payments**

| Table | Origin migration (first) | Used by |
|-------|--------------------------|---------|
| `people` | `20260227165000_nomi_people_time_payments_reports.sql` | **Also LBS** (commissions, calendar person link) |
| `time_entries` | same | Hours → payroll |
| `payments` | same | Payroll payment batches |
| `payment_lines` | same | Payment line items |
| `payroll_runs` | `20260309190000_payroll_runs_loans_and_hours_rules.sql` | Payroll runs |
| `payroll_run_lines` | same | Run lines |
| `employee_loans` | same | Employee loans |
| `employee_loan_deductions` | same | Loan deductions |
| `employee_pto_adjustments` | `20260311154500_employee_pto_adjustments.sql` | PTO |

**Contractor / construction deal economics**

| Table | Origin migration | Used by |
|-------|------------------|---------|
| `deal_subcontractors` | `20260310113000_projects_module_foundation.sql` | Contractor deal assignments |
| `deal_subcontractor_entries` | `20260311190000_project_details_operational_tabs.sql` | Contractor cost entries |
| `deal_workers` | (projects module) | Contractor labor (verify before drop) |

**Platform SaaS console**

| Table | Origin migration | Used by |
|-------|------------------|---------|
| `platform_operators` | `20260430120000_platform_saas_billing.sql` | `/sas` operator auth |

**Not non-LBS (keep for LBS billing — do not list for removal)**

- `deal_client_payments` — LBS client collections  
- `proposal_payment_*`, `client_invoices*` — LBS proposals/billing  
- `organization_members` — LBS staff (replaces `sales` for CRM users)

---

## Risk register (read before Phase 2+ code removal)

1. **`people` resource** — LBS commissions/calendar depend on it; deprecate UI first, migrate to `organization_members` or dedicated salesperson table before dropping.
2. **`src/platform/billingDefaults.ts` + `inviteBillingGate.ts`** — still used in LBS Settings → Users.
3. **`VITE_PRODUCT_MODE=contractor`** — today equals `!isLbsMode()`; removing non-LBS branches kills contractor builds unless product mode is deleted entirely.
4. **`src/reports/`** — split: keep web-agency metrics; peel off payroll reports.
5. **`fakerest/dataProvider.ts`** — imports loan helpers; update if demo stack changes.

---

## Suggested removal order (for future phases — not executed)

1. Delete duplicate ` 2.sql` migrations ✅ (Fase 0 done)  
2. Remove `SidebarLayout` / `Header` / `UserMenuItems` non-LBS branches  
3. Remove `CRM.tsx` `!isLbsMode()` routes & Resources (section A)  
4. Delete `src/timeEntries`, `src/payments`, `src/payrollRuns`, `src/loans` folders  
5. Split `src/people/` UI vs LBS `people` queries  
6. Split `src/reports/` and `src/platform/`  
7. Remove `src/contractor/` + contractor env build  
8. DB table retirement (separate decision + migrations)

---

*Generated: Fase 1 audit — NO CODE changes.*
