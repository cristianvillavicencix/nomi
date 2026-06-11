# Reports

## 1. Purpose

Internal analytics reports. Currently one report: **Web Agency Metrics** (monthly win rate / revenue from `report_web_agency_metrics` view).

## 2. Files & components

| Kind | Path |
|------|------|
| Routes | `/reports`, `/reports/web-agency-metrics` in `CRM.tsx` only |
| Pages | `src/reports/ReportsPage.tsx`, `WebAgencyMetricsReportPage.tsx`, `ReportFilters.tsx` |

**Not** in `LbsCustomRoutes.tsx` or sidebar navigation.

## 3. Database

| Table / view | Usage |
|--------------|--------|
| `report_web_agency_metrics` | Read-only view for chart/table |

## 4. External services

None.

## 5. Connections to other modules

| Direction | Module | Link |
|-----------|--------|------|
| Reads | Deals / billing aggregates | Via DB view definition |

## 6. Edge functions used by this module

**None.**

## 7. Status: PARTIAL

Report works when URL is known. Orphan route — see `19-orphaned-routes.md`.

## 8. Issues found

| Severity | Location | User impact | Root cause |
|----------|----------|-------------|------------|
| MEDIUM | Navigation | Users cannot discover reports | No sidebar link |
| MEDIUM | `ReportsPage.tsx` | Permission inconsistency | Page allows role `user`; capability catalog `reports.view` may deny `user` |
| LOW | Product | Single report only | No report switcher beyond query param tab |

## 9. Broken connections

- **Approved (2026-06-02):** KEEP route — add sidebar link under **Tools** in fix phase (`19-orphaned-routes.md`).
