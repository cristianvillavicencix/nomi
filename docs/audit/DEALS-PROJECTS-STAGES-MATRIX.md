# Website project stages — Keep / Merge / Kill

**Date:** 2026-09-04  
**Status:** **Accepted & implemented** (lazy Build = `development`)  
**Migration:** `20260904130000_shrink_website_pipeline_stages.sql`

---

## Final pipeline (9 stages)

| Order | Stage id | Label | Role |
|------:|----------|-------|------|
| 1 | `lead` | Lead | New opportunity / intake |
| 2 | `proposal_sent` | Proposal | Quote / proposal out |
| 3 | `won` | Won | Sold; kickoff / brief |
| 4 | `development` | Build | Design + development (one column) |
| 5 | `review` | Review | Client review |
| 6 | `launch` | Launch | Go-live + handoff |
| 7 | `maintenance` | Maintenance | Live / retainer / aftercare |
| 8 | `closed_won` | Closed | Successfully closed |
| 9 | `closed_lost` | Lost | Lost |

Kanban columns = project header steps (1:1).

---

## Matrix — former 12 stages

| Former stage | Decision | Maps to |
|--------------|----------|---------|
| `lead` | Keep | `lead` |
| `discovery` | Merge | `lead` |
| `proposal_sent` | Keep | `proposal_sent` |
| `pending_payment` | Kill (as stage) | `won` |
| `won` | Keep | `won` |
| `design` | Merge | `development` (Build) |
| `development` | Keep (label Build) | `development` |
| `review` | Keep | `review` |
| `launch` | Keep | `launch` |
| `maintenance` | Keep | `maintenance` |
| `closed_won` | Keep (label Closed) | `closed_won` |
| `closed_lost` | Keep (label Lost) | `closed_lost` |

---

## Vote checklist (locked)

- [x] Accept 9-stage target (incl. Lost)
- [x] Kill `pending_payment` as stage
- [x] Merge `discovery` → `lead`
- [x] Merge `design` → `development` labeled **Build**
- [x] Keep `maintenance` as its own column
- [x] Keep DB ids `closed_won` / `closed_lost` (UX labels Closed / Lost)
- [x] Header = kanban 1:1
