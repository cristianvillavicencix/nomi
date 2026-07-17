# Migration plans

Implementation plans for product migrations. Documents are English; chat with the team may be Spanish.

## Accounts hub (Leads + Clients consolidation)

**Option A architecture** — UI/nav hub over `companies` + `contacts` (no schema merge).  
**List / Board / commercial model (2026-07-16):** People-only List + company preview; Board = active leads on `contacts`; `companies.is_client` = derived bill-to only; new client work via **Deals** — [accounts-hub-DESIGN-DECISION.md](./accounts-hub-DESIGN-DECISION.md).

| Doc | Phase | Summary |
|-----|-------|---------|
| [00-accounts-hub-OVERVIEW.md](./00-accounts-hub-OVERVIEW.md) | — | Problem, locked decisions, roadmap, risks |
| [accounts-hub-UX-ANALYSIS.md](./accounts-hub-UX-ANALYSIS.md) | — | Why company-first List confused users |
| [accounts-hub-DESIGN-DECISION.md](./accounts-hub-DESIGN-DECISION.md) | — | People-only List + company preview; Board; commercial model (`is_client`, Deals) |
| [01-accounts-hub-PHASE-1-nav-shell.md](./01-accounts-hub-PHASE-1-nav-shell.md) | 1 | Nav item, hub shell, List\|Board toggle, redirects |
| [02-accounts-hub-PHASE-2-company-grouped-list.md](./02-accounts-hub-PHASE-2-company-grouped-list.md) | 2 | Historical company-grouped list plan (superseded by people-only + company preview) |
| [03-accounts-hub-PHASE-3-board-reuse.md](./03-accounts-hub-PHASE-3-board-reuse.md) | 3 | Reuse leads Kanban inside hub |
| [04-accounts-hub-PHASE-4-polish-permissions.md](./04-accounts-hub-PHASE-4-polish-permissions.md) | 4 | Spotlight, empty states, convert UX, docs |
| [05-accounts-hub-NO-REGRESSION-CHECKLIST.md](./05-accounts-hub-NO-REGRESSION-CHECKLIST.md) | QA | Manual QA matrix |
| [06-accounts-hub-ROLLBACK.md](./06-accounts-hub-ROLLBACK.md) | Ops | Per-phase rollback (no data migration) |

**Database:** Phases 1–4 planned no migrations. Later additive: `companies.is_client` (derived bill-to; not pipeline) — `20260916120000_companies_is_client.sql`.
