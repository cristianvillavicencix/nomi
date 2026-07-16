# Accounts hub — No-regression checklist

Manual QA matrix for consolidating Leads + Clients into the Accounts hub (Option A). Run after each phase as marked; full pass before production.

**Environments:** staging (hosted Supabase) preferred. FakeRest demo for UI-only smoke.

**DB migrations in phases 1–4:** none — if a migration appears in the PR, stop and escalate.

## Legend

| Symbol | Meaning |
|--------|---------|
| P1–P4 | Phase when this check becomes mandatory |
| ✓ | Pass |
| ✗ | Fail (block release) |
| N/A | Not applicable yet |

---

## A. Navigation & deep links

| # | Check | P1 | P2 | P3 | P4 |
|---|-------|----|----|----|-----|
| A1 | Sidebar shows single **Accounts** entry (not competing Pipeline + Clients) | ✓ | | | |
| A2 | `/accounts` loads hub | ✓ | | | |
| A3 | List \| Board toggle works; preference persists | ✓ | | | |
| A4 | `/leads` opens Board (redirect or alias) | ✓ | | ✓ | |
| A5 | `/clients` opens List | ✓ | ✓ | | |
| A6 | `/companies` and `/contacts` still open List aliases | ✓ | ✓ | | |
| A7 | `/leads?create=lead` opens create lead dialog | ✓ | | ✓ | |
| A8 | `/clients?create=company` / `?tab=people&create=contact` work | ✓ | ✓ | | |
| A9 | `/leads/:id/show` and `/leads/:id/show?stage=` work | ✓ | | ✓ | |
| A10 | `/companies/:id` and `/contacts/:id/show` work | ✓ | ✓ | | |
| A11 | Legacy `/clients/:id/show` redirects to company show | ✓ | | | |
| A12 | `getLeadsListPath` / `getClientsListPath` / `getPersonShowPath` callers (dashboard, proposals, tickets) land correctly | ✓ | | ✓ | ✓ |

---

## B. List (company-grouped)

| # | Check | P2 | P4 |
|---|-------|----|-----|
| B1 | Companies are parent rows | ✓ | |
| B2 | Contacts nest under correct `company_id` | ✓ | |
| B3 | Primary contact ordered/pinned when set | ✓ | |
| B4 | Orphan leads (no company) visible in “No company” | ✓ | |
| B5 | Company click → bill-to show `/companies/:id` | ✓ | |
| B6 | Lead contact click → lead show; client contact → contact show | ✓ | |
| B7 | Pipeline / Clients filters use supported operators only (`@in`, etc.) | ✓ | |
| B8 | Search does not 400 PostgREST | ✓ | |
| B9 | Nested fetch is batched (no N+1 per company in network tab) | ✓ | |
| B10 | Empty states offer New company / New lead | ✓ | ✓ |

---

## C. Board / Kanban / Anti-Olvido

| # | Check | P3 | P4 |
|---|-------|----|-----|
| C1 | Columns match `leadStages.ts` board stages | ✓ | |
| C2 | Drag opens stage dialog; save updates `lead_stage` | ✓ | |
| C3 | Follow-up / snooze fields behave as before | ✓ | |
| C4 | Overdue styling / enrichment still shows | ✓ | |
| C5 | Won path opens convert dialog | ✓ | |
| C6 | Lost / terminal handling unchanged | ✓ | |
| C7 | Companies do **not** appear as columns | ✓ | |
| C8 | Deal stage change still syncs contact `lead_stage` (trigger smoke) | ✓ | |

---

## D. Convert lead → client

| # | Check | P3 | P4 |
|---|-------|----|-----|
| D1 | `ConvertLeadButton` succeeds | ✓ | ✓ |
| D2 | Company created or linked; contact status client | ✓ | |
| D3 | Navigate to `/companies/:id` | ✓ | |
| D4 | Optional deal create still works when enabled | ✓ | |
| D5 | Kanban won convert same as button | ✓ | |
| D6 | Converted person appears under company in List | ✓ | |

---

## E. Billing (must not break)

| # | Check | Any phase |
|---|-------|-----------|
| E1 | Open `/billing`; list invoices | |
| E2 | Create standalone invoice; `company_id` bill-to required/saved | |
| E3 | Public invoice link `/invoice/:token` still pays/views | |
| E4 | Client portal `/portal` and `/portal/invoice/:token` | |
| E5 | Proposal → invoice path still ties to company | |
| E6 | Company Financial tab still lists invoices | |

---

## F. Tickets

| # | Check | Any phase |
|---|-------|-----------|
| F1 | `/tickets` list loads | |
| F2 | Create ticket linked to company/contact | |
| F3 | Ticket show resolves requester company | |
| F4 | Company show tickets tab/count | |

---

## G. Deals / Projects

| # | Check | Any phase |
|---|-------|-----------|
| G1 | `/deals` Kanban/list loads | |
| G2 | Create deal with `company_id` | |
| G3 | Company show deals/projects sidebar | |
| G4 | Lead → convert with deal option (if used) | |

---

## H. Portal & public surfaces

| # | Check | Any phase |
|---|-------|-----------|
| H1 | Portal short URLs `/p/:code` | |
| H2 | Booking / forms public routes unaffected | |
| H3 | Proposal public accept unaffected | |

---

## I. Imports & integrations

| # | Check | P4 |
|---|-------|-----|
| I1 | Contact CSV import still works; links open | ✓ |
| I2 | Zoho oneshot import (if enabled) creates leads visible on Board | ✓ |
| I3 | Google Places on company/lead forms still works | ✓ |
| I4 | Find duplicates `/companies/find-duplicates` | ✓ |

---

## J. Permissions

| # | Check | P1 | P4 |
|---|-------|----|-----|
| J1 | Admin with both caps: List + Board | ✓ | ✓ |
| J2 | Companies-only: List companies; no Board (or Board hidden) | ✓ | ✓ |
| J3 | Contacts-only: Board + people; companies tab hidden | ✓ | ✓ |
| J4 | No access: redirected from hub | ✓ | |
| J5 | Spotlight does not show forbidden modules | | ✓ |

---

## K. Mobile & chrome

| # | Check | P1 | P4 |
|---|-------|----|-----|
| K1 | Hub usable on narrow viewport | ✓ | ✓ |
| K2 | Mobile kanban show path still works | | ✓ |
| K3 | Mobile nav reaches Accounts | | ✓ |
| K4 | Spotlight open/close on mobile | | ✓ |

---

## L. Sign-off

| Role | Name | Date | Build / commit |
|------|------|------|----------------|
| Engineer | | | |
| Reviewer | | | |

**Blockers found:**

1. …
2. …

**Notes:**

-
