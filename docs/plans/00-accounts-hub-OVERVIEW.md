# Accounts hub — Overview (Option A)

## Problem

Users today have **two doors** for one mental journey:

| Door | Nav label | Route | Mental job |
|------|-----------|-------|------------|
| Pipeline | “Pipeline” | `/leads` | Know → qualify → close (people + `lead_stage`) |
| Clients | “Clients” | `/clients` | Bill-to companies + directory people |

The data model already matches the journey correctly (`companies` = bill-to, `contacts` = people/leads, `lead_stage` = pipeline). The product surface does not: staff must choose the wrong door, lose context, or duplicate mental models (Companies vs People tabs vs Leads table/kanban).

## Goals

1. Present **one primary nav module** (“Accounts”) that covers know → close → bill.
2. Keep **list** company-first (flat companies); people via primary contact + preview Contacts tab; bill-to remains `company_id`.
3. Keep **board/Kanban** as opportunities/people via existing `contacts.lead_stage` (not company columns).
4. Preserve deep links and aliases: `/leads`, `/clients`, `/companies`, `/contacts` (redirect or mount hub).
5. Zero breakage for billing (`client_invoices`), tickets, portal, deals, convert, Anti-Olvido, RLS, capabilities, Zoho/CSV import.

## Non-goals

- **Do not** merge `companies` + `contacts` into a single Account entity (Option C forbidden).
- **Do not** put companies as Kanban columns or treat company as the pipeline entity.
- **Do not** change bill-to FK (`company_id` on invoices, tickets, deals, proposals, contracts, portal).
- **Do not** rewrite `convertLeadToClient`, deal↔`lead_stage` triggers, or RLS policies as part of this hub work (except additive `companies.is_client` sync — see commercial model).
- **Do not** remove legacy URL paths; redirect or alias them.

> **Migrations note:** Original phases 1–4 assumed no DB changes. Later work added derived `companies.is_client` (bill-to signal only). Pipeline remains on contacts.

## Locked product decisions

| Decision | Choice |
|----------|--------|
| Architecture | **Option A** — UI/nav hub over existing tables (`companies` + `contacts`) |
| Schema merge | **Forbidden** |
| List view (default) | **Company-first** flat `companies` table. Primary contact + channels on the row; Sheet preview (`?company=`) with Contacts tab. See [accounts-hub-DESIGN-DECISION.md](./accounts-hub-DESIGN-DECISION.md). |
| Board view | Active leads Kanban only (`lead`/`prospect` + board stages; no Client column). Convert drops cards off the board. Pipeline = `contacts.status` / `lead_stage`. |
| Bill-to | Always `companies.id` / `company_id`. **`companies.is_client`** = derived bill-to signal (not pipeline). |
| New commercial work | **Deals** (incl. existing clients): `company_id`, contact(s), owner, deal stage — not company-as-pipeline. |
| URLs | Preserve `/leads`, `/clients`, `/companies`, `/contacts` |
| Phasing | Nav shell → list → board reuse → polish |

> **Note (2026-07-16):** Early phases described List as company-first, then people-only + By company toggle. Current decision: **Company-first List + company preview drawer**; Board stays active-pipeline; Client badge + New Deal from company preview. Analysis: [accounts-hub-UX-ANALYSIS.md](./accounts-hub-UX-ANALYSIS.md). Full commercial model: [accounts-hub-DESIGN-DECISION.md](./accounts-hub-DESIGN-DECISION.md).


## Current codebase anchors (do not invent paths)

| Area | Real paths |
|------|------------|
| Nav | `src/app/navigation.ts` — `LBS_NAV_STANDALONE` (Pipeline `/leads`), `LBS_CLIENTS_NAV_ITEM` (`/clients`) |
| Routes | `src/app/LbsCustomRoutes.tsx` — `/leads`, `/clients`, `/companies`, `/contacts`, show/create redirects |
| Routing helpers | `src/app/routing.ts` — `getClientsHubPath`, `getLeadsListPath`, `getClientShowPath`, `getLeadShowPath`, … |
| Clients hub | `src/modules/clients/ClientsHubPage.tsx`, `ClientsHubRoute.tsx`, `clientsHubTabs.ts`, `clientsHubAccess.ts`, `clientsHubSearchParams.ts` |
| Lists | `CompaniesListPage.tsx`, `ContactsListPage.tsx` (embedded in hub) |
| Leads | `src/modules/leads/LeadsListPage.tsx` (table \| kanban), `LeadsKanban.tsx`, `leadStages.ts` |
| Convert | `ConvertLeadButton.tsx`, `ConvertWonLeadDialog.tsx`, `dataProvider.convertLeadToClient` in `src/components/atomic-crm/providers/supabase/modules/dealsProvider.ts` |
| Permissions | `src/lib/permissions/permissionCatalog.ts` — `crm.contacts.view`, `crm.companies.view` |
| Spotlight | `src/components/atomic-crm/layout/SpotlightSearchButton.tsx` — modules `leads` \| `clients` \| `contacts` |
| Summary views | `companies_summary`, `contacts_summary` via dataProvider (`getList`/`getOne` remaps) |

**Note:** Audit docs under `docs/audit/` still cite legacy `src/lbs/…` paths. Implementation lives under `src/modules/leads`, `src/modules/clients`, `src/modules/contacts`, and `src/app/`.

## Success criteria

Staff mental model and chrome: [crm-core-glossary-and-surfaces.md](./crm-core-glossary-and-surfaces.md) (Account → Person → Deal; **Client** = badge only).

- One primary sidebar entry for the Accounts journey; Pipeline + Clients are no longer two competing top-level doors (legacy URLs still work as redirects).
- List: **company-first** Accounts; Account Sheet preview; Person via primary contact / Contacts tab; **Client** badge when `is_client`; **New Deal** from Account preview.
- Board: active lead pipeline only (no Client column); convert-to-client drops cards; Anti-Olvido for client follow-up.
- **One Person Full** at `/contacts/:id/show`; `/leads/:id/show` redirects there; Account Full stays `/companies/:id`.
- Tickets and deals staff chrome use **Account** / **Person** labels and shared routing helpers.
- Invoices, tickets, portal, deals continue to resolve by `company_id`; new work for existing clients uses **Deals**.
- Capability matrix unchanged in meaning: users who can list companies and/or contacts still can; hub hides inaccessible modes.
- Manual QA checklist (`05-…`) passes; rollback (`06-…`) does not require data undo.

## Phased roadmap summary

| Phase | Doc | Deliverable | Risk | DB |
|-------|-----|-------------|------|-----|
| 1 | [01-…nav-shell](./01-accounts-hub-PHASE-1-nav-shell.md) | Accounts nav + hub shell + List\|Board chrome + redirects | Low | None |
| 2 | [02-…company-grouped-list](./02-accounts-hub-PHASE-2-company-grouped-list.md) | Company-first nested list + filters | Medium (perf/UX) | None |
| 3 | [03-…board-reuse](./03-accounts-hub-PHASE-3-board-reuse.md) | Embed existing Kanban in hub Board mode | Low–medium | None |
| 4 | [04-…polish-permissions](./04-accounts-hub-PHASE-4-polish-permissions.md) | Spotlight, empty states, convert copy, docs | Low | None |

**Dependencies:** Phase 2 and 3 both depend on Phase 1 shell (view toggle + routing). Phase 2 and 3 can proceed in parallel after Phase 1. Phase 4 depends on 2 + 3 being usable.

## Account record motor (2026-08)

Status: **shipped in product UI** (no schema change). The company show at `/companies/:id` is the HubSpot-style Account center of gravity:

| Surface | Behavior |
|---------|----------|
| Account Full | Center tabs: Activity, **People**, Deals, Financial, Tickets. Related sidebar collapsed into People. |
| Contact / Lead show | **Open Account** banner when `company_id` set; Tickets center tab; meta label **Account**. |
| Tickets / Deals headers | Company → Account Full (`?tab=deals` from deals). |
| Accounts List preview | Primary CTA **Open Account**. |
| Chrome | Back → Accounts (when hub flag on); New deal / New ticket scoped to `company_id`. |

Still **Option A**: Account = `companies`, people = `contacts`. Do not delete `/clients` or `/leads` aliases.

### Manual QA (Account motor)

- [ ] Open Account Full → People / Deals / Financial / Tickets tabs; Add contact / New deal / New ticket keep `company_id`.
- [ ] Open Contact with company → Account banner + Open Account; Tickets tab lists person tickets.
- [ ] Open Lead with company → same banner; Tickets tab present.
- [ ] From ticket header → Account Full; from deal header → Account `?tab=deals`.
- [ ] Accounts List preview → **Open Account** goes to `/companies/:id`.
- [ ] Convert lead still drops board card; billing still `company_id`.

## Risk register

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| R1 | Schema merge pressure (“just one Account table”) | Med | Critical | Locked: Option C forbidden; call out in every PR |
| R2 | Breaking bill-to / `client_invoices.company_id` | Low if UI-only | Critical | No FK/schema changes; QA matrix |
| R3 | Kanban becomes company columns | Med (design drift) | High | Phase 3 explicitly reuses contact `lead_stage` board |
| R4 | Capability split (contacts-only vs companies-only users) | Med | Medium | Mirror `clientsHubAccess` + contacts list access for Board |
| R5 | Nested list N+1 / slow `getList` | Med | Medium | Phase 2: batch contacts by `company_id@in`, reuse summaries |
| R6 | Deep-link / bookmark breakage | Med | Medium | Redirects + alias mounts; keep helpers in `routing.ts` |
| R7 | Spotlight / Dashboard still say “Pipeline” vs “Clients” | Low | Low | Phase 4 alignment |
| R8 | localStorage filters (`lbs.leads.view`, list store keys) confuse hub | Med | Low | Document migration of keys; cleanup legacy `@nin` keys already handled in leads |

## Related reading

- `docs/audit/03-leads.md`, `docs/audit/04-companies-clients.md` (behavior; paths outdated)
- `docs/architecture/modules.md` — do not rename `companies_summary` / `contacts_summary`
- `PLAN_FASE_1.md` / Anti-Olvido — `lead_stage`, `snooze_until`, deal sync triggers
