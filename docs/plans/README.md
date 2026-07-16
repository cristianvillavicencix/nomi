# Migration plans

Implementation plans for product migrations. Documents are English; chat with the team may be Spanish.

## Accounts hub (Leads + Clients consolidation)

**Option A** — UI/nav hub that presents one mental model while keeping `companies` + `contacts` in the database. **Do not** merge into a single Account table (Option C forbidden).

| Doc | Phase | Summary |
|-----|-------|---------|
| [00-accounts-hub-OVERVIEW.md](./00-accounts-hub-OVERVIEW.md) | — | Problem, locked decisions, roadmap, risks |
| [01-accounts-hub-PHASE-1-nav-shell.md](./01-accounts-hub-PHASE-1-nav-shell.md) | 1 | Nav item, hub shell, List\|Board toggle, redirects |
| [02-accounts-hub-PHASE-2-company-grouped-list.md](./02-accounts-hub-PHASE-2-company-grouped-list.md) | 2 | Company-first list with nested contacts |
| [03-accounts-hub-PHASE-3-board-reuse.md](./03-accounts-hub-PHASE-3-board-reuse.md) | 3 | Reuse leads Kanban inside hub |
| [04-accounts-hub-PHASE-4-polish-permissions.md](./04-accounts-hub-PHASE-4-polish-permissions.md) | 4 | Spotlight, empty states, convert UX, docs |
| [05-accounts-hub-NO-REGRESSION-CHECKLIST.md](./05-accounts-hub-NO-REGRESSION-CHECKLIST.md) | QA | Manual QA matrix |
| [06-accounts-hub-ROLLBACK.md](./06-accounts-hub-ROLLBACK.md) | Ops | Per-phase rollback (no data migration) |

**Database migrations required for phases 1–4:** none.
