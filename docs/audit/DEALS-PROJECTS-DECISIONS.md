# Deals / Projects — Locked decisions (Phase 0–4 + stages)

**Date:** 2026-09-04  
**Updated:** 2026-09-04 — pipeline shrink accepted

## Product

| Decision | Choice |
|----------|--------|
| UI language | **Project(s)** everywhere staff-facing |
| API / resource / routes | Keep `deals`, `/deals`, `/projects` → `/deals` redirect |
| Stages | **9-stage** web pipeline (see below); kanban = header 1:1 |
| Status columns | No migration of `lifecycle_phase` / `delivery_status` columns themselves |
| Money | No table merge; Financials unchanged; Billing narrative later |
| Create | One staff create UI: `/deals/create`. Thin `NewDealDialog` removed |
| Gates | Brief + launch checklist banners; soft block in Deliver |
| Dead UI | Unused `ProjectDeliveryTab` deleted; keep `LEGACY_TAB_MAP` |

## Pipeline (accepted)

| Order | id | Label |
|------:|----|-------|
| 1 | `lead` | Lead |
| 2 | `proposal_sent` | Proposal |
| 3 | `won` | Won |
| 4 | `development` | Build |
| 5 | `review` | Review |
| 6 | `launch` | Launch |
| 7 | `maintenance` | Maintenance |
| 8 | `closed_won` | Closed |
| 9 | `closed_lost` | Lost |

Remaps: `discovery`→`lead`, `pending_payment`→`won`, `design`→`development`.  
See [`DEALS-PROJECTS-STAGES-MATRIX.md`](DEALS-PROJECTS-STAGES-MATRIX.md).

## Out of scope (later)

Overview dashboard tab redesign, new `build` stage id, Stripe/Financials unification, mobile kanban, profile modes, Hostinger/web-audit on project show, killing status columns.
