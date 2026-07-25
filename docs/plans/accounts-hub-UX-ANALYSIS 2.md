# Accounts module — UX analysis

**Date:** 2026-07-16  
**Status:** Historical analysis. Current product decision: [accounts-hub-DESIGN-DECISION.md](./accounts-hub-DESIGN-DECISION.md) (Company-first List + company preview; Board = active leads).

## Problem

Accounts hub merged Pipeline + Clients into one nav door (Option A: UI over `companies` + `contacts`). List was **company-first** with nested people; Board was leads Kanban by `lead_stage`.

Users think: **leads are contacts**; List should be “my people”; Board should be follow-up. Company-first List forced a two-level mental model for a person-centric task.

## Data (unchanged shape; additive `is_client`)

| Concept | Storage |
|---------|---------|
| Bill-to account | `companies` |
| Derived “is client account?” | `companies.is_client` (bill-to signal only — **not** pipeline) |
| Person (lead or contact) / pipeline | `contacts` (`status` + optional `lead_stage`) — Board, Anti-Olvido, routing |
| New commercial work | **Deals** (`company_id`, contact(s), owner, deal stage) |
| Primary contact | `companies.primary_contact_id` / `contacts_summary.is_primary_contact` |

## Decision

See **[accounts-hub-DESIGN-DECISION.md](./accounts-hub-DESIGN-DECISION.md)** — People-only flat List; company via column + Sheet preview; Board active pipeline only (no Client column); Client badge + New Deal from company preview; pipeline stays on contacts.
