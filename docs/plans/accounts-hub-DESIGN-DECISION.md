# Accounts module — Design decision

**Date:** 2026-07-16 (refined same day; commercial model locked)  
**Based on:** [accounts-hub-UX-ANALYSIS.md](./accounts-hub-UX-ANALYSIS.md)  
**Status:** Decided — implemented (People-only List + company preview; Board = active leads; Client badge + New Deal)

---

## Decision

**People-only List + company preview drawer. Board scoped to active pipeline leads. Commercial follow-on work for existing clients goes through Deals.**

### List

- **Single flat table** of people (leads + directory contacts). No People | By company toggle.
- Columns: **Name** (avatar + Primary badge when `is_primary_contact`) | **Company** | **Phone** | **Email** | **Status / Stage**.
- Sort preference: people with a company first (by name), then people without a company. Filter chip **No company** (`company_id` null).
- Click **person** (row / name) → person Sheet preview (leads and contacts).
- Click **Company** cell → company Sheet preview (`?company=`): name, website, phone, email, address; **Client** badge when `companies.is_client`; **Contacts** tab (open person preview); **New Deal** (opens existing deal create with `company_id` prefilled); **View full** → company show.
- Website lives on the company preview, not the person row.

### Board

- Unchanged Kanban: columns = active `lead_stage` pipeline (`LBS_LEAD_KANBAN_BOARD_STAGES`). **No Client / Won / Lost columns.**
- List filter = lead lifecycle statuses only (`lead` / `prospect` + legacy). Convert → `status=client` + terminal stage drops the card off the Board.
- Client follow-up remains Anti-Olvido / company surfaces, not the Kanban.

### Commercial model (locked)

| Concern | Where it lives | Notes |
|---------|----------------|-------|
| **Pipeline** (know → qualify → close) | `contacts.status` + `contacts.lead_stage` | Board, Anti-Olvido, routing. Company is **not** a pipeline entity. |
| **Bill-to / “is this a client account?”** | `companies.is_client` | **Derived** signal only (triggers/backfill from linked contacts with `status=client` and/or deals in won stages). Not editable as pipeline. Does **not** move pipeline onto the company. |
| **New commercial work** (incl. existing clients) | **Deals** | Opportunity records: `company_id`, contact(s), owner, deal stage. New work for an existing client is a **new Deal**, not a company Kanban card or re-opening company-as-pipeline. |

Migration: `supabase/migrations/20260916120000_companies_is_client.sql`.

## Why

- Leads and contacts are the same entity (`contacts`, different `status`) — List should be “my people.”
- A By company list mode duplicated bill-to browsing; company context + company preview is enough.
- Board already answers “what needs follow-up today” for open pipeline only.
- `is_client` answers “can we bill this company?” without conflating bill-to with open pipeline.
- Deals already model opportunities against a bill-to company; reusing that path avoids inventing a second pipeline on companies.

## Rejected / superseded

| Idea | Why not |
|------|---------|
| Company-first nested List (early Phase 2) | Wrong default mental model |
| Rename List → “Companies” only | No people directory |
| People \| Companies tabs | Extra chrome |
| **People \| By company toggle** (earlier Option B) | Still two list modes; replaced by company preview |
| Client column on Board | Clients are not pipeline work |
| Treating `companies` as the pipeline entity | Pipeline stays on contacts; company is bill-to |
| Manual / primary `is_client` as stage | Field is derived bill-to only |

## What does not change

- Schema shape: `companies` + `contacts` only — no `accounts` table. (`companies.is_client` is an additive derived column, not a schema merge.)
- Bill-to FK: invoices / tickets / deals use `company_id`.
- `primary_contact_id` / `is_primary_contact` badge on person rows.
- Board / Anti-Olvido / routing continue to use `contacts.status` + `lead_stage`.

## UI shipped (commercial surfaces)

- **Client** badge on Accounts List company context and company preview when `is_client`.
- **New Deal** from company preview → existing deal create flow with `company_id` prefilled.

## Code anchors

| Area | Path |
|------|------|
| List host | `src/modules/accounts/AccountsGroupedList.tsx` → `AccountsPeopleList.tsx` |
| Person preview | `AccountsLeadPreviewSheet.tsx` |
| Company preview | `AccountsCompanyPreviewSheet.tsx`, `AccountsCompanyOverviewPreview.tsx` |
| Board | `src/modules/leads/LeadsBoardPanel.tsx`, `LeadsKanban.tsx`, `leadStages.ts` |
| `is_client` migration | `supabase/migrations/20260916120000_companies_is_client.sql` |

Removed: `AccountsCompanyGroupedList.tsx` (By company list mode; superseded by company Sheet preview).

## Related

- Overview: [00-accounts-hub-OVERVIEW.md](./00-accounts-hub-OVERVIEW.md)
- Analysis: [accounts-hub-UX-ANALYSIS.md](./accounts-hub-UX-ANALYSIS.md)
- QA: [05-accounts-hub-NO-REGRESSION-CHECKLIST.md](./05-accounts-hub-NO-REGRESSION-CHECKLIST.md)
