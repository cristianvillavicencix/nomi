# Dashboard

## 1. Purpose

Home page at `/` after login. Onboarding stepper when the org has no contacts or notes; otherwise shows hot contacts, deals chart, activity log, and LBS task widget. Demo mode adds a welcome banner via `VITE_IS_DEMO`.

## 2. Files & components

| Kind | Path |
|------|------|
| Route | `/` — `src/components/atomic-crm/root/CRM.tsx` |
| Page | `src/components/atomic-crm/dashboard/Dashboard.tsx` |
| Mobile | `src/components/atomic-crm/dashboard/MobileDashboard.tsx` |
| Widgets | `DashboardActivityLog.tsx`, `DealsChart.tsx`, `HotContacts.tsx`, `DashboardStepper.tsx`, `Welcome.tsx` |
| LBS widget | `src/lbs/dashboard/LbsDashboardTasks.tsx` |
| Activity backend | `src/components/atomic-crm/providers/commons/activity.ts` via `dataProvider.getActivityLog()` |

## 3. Database

| Table / view | Usage |
|--------------|--------|
| `contacts` | Count + hot list |
| `contact_notes` | Onboarding gate (count) |
| `deals` | Count + chart |
| `tasks` | LBS dashboard tasks widget |
| Activity aggregates | `companies`, `contacts`, `deals`, `contact_notes`, `deal_notes` via `getActivityLog` |

RLS: inherits org-scoped policies on each table (`org_id` / member visibility). No dashboard-specific policies.

## 4. External services

None directly from Dashboard UI.

## 5. Connections to other modules

| Direction | Module | Link |
|-----------|--------|------|
| Reads | Contacts | Hot contacts, stepper |
| Reads | Deals | Chart, counts |
| Reads | Tasks | `LbsDashboardTasks` |
| Reads | Activity | Unified feed from companies/contacts/deals/notes |

## 6. Edge functions used by this module

**None.** All data via PostgREST / `dataProvider.getActivityLog()` (client-side aggregation).

## 7. Status: WORKING

`tsc --noEmit` passes. No runtime crashes identified in this module.

## 8. Issues found

| Severity | Location | User impact | Root cause |
|----------|----------|-------------|------------|
| LOW | `Dashboard.tsx:34-36` | Blank screen while loading | Returns `null` with no skeleton |
| LOW | `Dashboard.tsx:38-44` | New orgs stuck on stepper | By design until first contact + note |
| MEDIUM | Mobile | Reduced dashboard on mobile shell | `MobileDashboard` may not show deals chart — verify parity |

## 9. Broken connections

- `DealsChart` uses `dealStages` from config — OK.
- No `person_id` revert leftovers in dashboard code.
