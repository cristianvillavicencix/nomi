# Phase 4 — Polish, permissions, docs

**Status:** Plan only  
**Risk:** Low  
**Depends on:** Phases 1–3 usable in staging  
**DB migrations:** None

## Goal

Align secondary surfaces (Spotlight, empty states, convert copy, capability labels, analytics/docs) with the Accounts hub so the product reads as one journey end-to-end—without changing billing FKs or pipeline write paths.

## Workstreams

### 1. Spotlight

**File:** `src/components/atomic-crm/layout/SpotlightSearchButton.tsx`

Today modules: `leads` | `clients` | `contacts` with path prefixes `/leads`, `/companies`/`/clients`, `/contacts`.

Plan:

- Treat Accounts as the primary grouping in UI copy (“Accounts” section header) while still searching companies + contacts + lead-status contacts.
- Prefer navigating to `getAccountsHubPath` / existing show helpers (`getClientShowPath`, `getLeadShowPath`, `getContactShowPath`).
- Avoid triple-counting the same contact under Leads and Contacts when searching; dedupe by contact id with a single row and the correct show path (`getPersonShowPath`).
- Keep capability gates tied to existing `modulePermissions.crm` / resource access—do not weaken access checks.

### 2. Empty states & CTAs

| Surface | Copy direction (English) |
|---------|---------------------------|
| Accounts List empty | “No accounts yet” + New company / New lead |
| No company (orphans) | “Leads without a company” + Link company / New company |
| Board empty column | Keep existing kanban empty affordances |
| Convert success | “Converted to client” → open company (bill-to) |

Update `CompanyEmpty`, `ContactEmpty`, and any hub-specific empties so they do not say “go to Pipeline” / “go to Clients” as separate products.

### 3. Convert UX

**Files:** `ConvertLeadButton.tsx`, `ConvertWonLeadDialog.tsx`, kanban won path in `LeadsKanban.tsx`

- Keep calling `dataProvider.convertLeadToClient` — **no API change**.
- Soften copy: converting creates/links the **bill-to company** and moves the person into the client journey; optional deal creation unchanged.
- Ensure post-convert navigation uses `getClientShowPath` (already).
- Optional: from Accounts List, surface “Convert” on nested lead rows (calls same button/dialog)—nice-to-have, not required if Board remains primary convert surface.

### 4. Permission / capability alignment

**Files:** `src/lib/permissions/permissionCatalog.ts`, `clientsHubAccess.ts`, new `accountsHubAccess.ts` if needed

| Today | Phase 4 |
|-------|---------|
| `crm.contacts.view` — “View contacts & leads” | Keep id; optional label tweak: “View people & pipeline” |
| `crm.companies.view` — “View clients & companies” | Keep id; optional: “View accounts (companies)” |
| Nav capability on Accounts item | OR of contacts list + companies list access |

Do **not** add a new required capability that locks out existing roles. Any `crm.accounts.view` must be a derived convenience, not a migration of role matrices.

Update tests: `permissionCatalog.test.ts`, `clientsHubAccess.test.ts`, new accounts access tests.

### 5. Notifications & dashboard

| File | Change |
|------|--------|
| `notificationCategoryAccess.ts` | Keep `crm.contacts.view` for lead follow-up categories; labels may say Accounts |
| `DashboardLeadsCard.tsx` | Link to Accounts Board; title “Pipeline” → “Accounts pipeline” or “Open pipeline” |

### 6. Mobile navigation

**File:** `src/components/atomic-crm/layout/MobileNavigation.tsx`

Today emphasizes `/contacts` and `/companies`. Align bottom nav or overflow menu with Accounts hub entry; ensure `/accounts` and redirects do not 404 on mobile.

### 7. Docs & analytics

| Doc / surface | Update |
|---------------|--------|
| `docs/architecture/modules.md` | Point Leads/Clients UI to Accounts hub; stress tables unchanged |
| `docs/audit/03-leads.md`, `04-companies-clients.md` | Add “superseded UI entry” note + link to `docs/plans/` (do not rewrite full audits unless asked) |
| Product analytics events (if any) | Rename event properties carefully; keep ids stable |
| ModuleInfoPopover strings | Accounts-centric descriptions |

### 8. Import / Zoho / CSV

No code path change required if imports still write `contacts` / `companies`. Verify Settings data import and contact CSV still open correct post-import links (`getPersonShowPath` / Accounts list). Document in QA checklist only unless a hardcoded `/leads` label remains in Settings UI.

## Acceptance criteria

- [ ] Spotlight finds companies and people; opens correct show routes; no access leaks.
- [ ] Empty states and ModuleInfo copy refer to Accounts (English).
- [ ] Convert UX unchanged functionally; copy consistent with bill-to company.
- [ ] Permission labels updated without breaking role matrices.
- [ ] Dashboard / notifications deep-link to Accounts Board where appropriate.
- [ ] Mobile can reach List and Board.
- [ ] Architecture doc notes Option A / no schema merge.
- [ ] No DB migration.

## Estimated effort

~2–3 days (copy + Spotlight dedupe + permission labels + mobile + docs).

## Out of scope

- Schema merge, new summary views, edge-function convert move
- Renaming database tables or PostgREST resources
- Removing `/leads` or `/clients` URL support
