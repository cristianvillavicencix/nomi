# Phase 1 — Accounts nav shell

**Status:** Plan only  
**Risk:** Low  
**Depends on:** Nothing (first shippable slice)  
**Unblocks:** Phases 2 and 3  
**DB migrations:** None

## Goal

Replace the dual top-level doors (**Pipeline** `/leads` + **Clients** `/clients`) with a single **Accounts** nav entry and a hub shell that supports **List | Board** chrome, while preserving all existing URLs via redirects or alias mounts.

This phase intentionally keeps **existing list and kanban implementations** behind the shell (thin wrapper). Company-grouped list and deep board integration land in later phases.

## Product behavior

1. **Sidebar / header:** One primary item — label **Accounts**, default `to: "/accounts"` (or `/clients` if product prefers zero new path — see routing decision below).
2. **Hub chrome:** Page title “Accounts”; toggle **List | Board** (same UX pattern as `LeadsListPage` table|kanban `ToggleGroup`).
3. **List mode (Phase 1 interim):** Render today’s Clients hub content (`ClientsHubPage` Companies | People) **or** a temporary note + existing companies list — do **not** block Phase 1 on nested list.
4. **Board mode (Phase 1 interim):** Render existing `LeadsListPage` kanban path **or** navigate/embed `/leads` kanban inside the shell without rewriting stage logic.
5. **Legacy URLs:** Continue to resolve:
   - `/leads` → Accounts Board (or redirect to `/accounts?view=board`)
   - `/clients`, `/companies`, `/contacts` → Accounts List (or keep mounting hub as today)
6. **Show routes unchanged:** `/companies/:id`, `/leads/:id/show`, `/contacts/:id/show` stay as-is.

## Routing decision (pick one in implementation PR)

| Option | Canonical path | Pros | Cons |
|--------|----------------|------|------|
| **A (recommended)** | `/accounts` | Clear product name; room for `?view=` / `?tab=` | New path + redirects |
| **B** | Keep `/clients` as canonical hub | Fewer new routes | “Clients” name under-sells pipeline |

Plans below assume **Option A** (`/accounts`). If B is chosen, map `/accounts` → `/clients` in docs and code.

### Suggested URL contract

| URL | Behavior |
|-----|----------|
| `/accounts` | Hub; default view = List (or last persisted) |
| `/accounts?view=list` | List mode |
| `/accounts?view=board` | Board mode |
| `/accounts?view=list&tab=companies\|people` | List + existing Clients hub tabs (until Phase 2) |
| `/leads` | Redirect → `/accounts?view=board` **or** mount board shell with same storeKey |
| `/leads?create=lead` | Preserve create query after redirect |
| `/leads/:id/show` | Keep show (no redirect required); optional `?from=accounts` later |
| `/clients` | Redirect → `/accounts?view=list` **or** continue alias mount |
| `/companies`, `/contacts` | Keep alias mounts (today’s `ClientsHubList`) pointing at List mode |

Persist view preference: e.g. `localStorage` key `lbs.accounts.view` (mirror `lbs.leads.view` in `LeadsListPage.tsx`).

## Capabilities mapping

Today:

| Nav item | Capability hint | ProtectedRoute resource |
|----------|-----------------|-------------------------|
| Pipeline `/leads` | `crm.contacts.view` | `contacts` / `list` |
| Clients `/clients` | (item has no capability field; guard via hub tabs) | Hub uses `companies` + `contacts` via `clientsHubAccess.ts` |

Phase 1:

| Mode | Access rule |
|------|-------------|
| Enter `/accounts` | At least one of: companies list **or** contacts list (same spirit as `ClientsHubRoute` + leads access) |
| List mode | Reuse `getAccessibleClientsHubTabs` / `canAccessClientsHubTab` |
| Board mode | Require `canAccess(identity, { resource: "contacts", action: "list" })` — same as `/leads` |

If user can only see companies: show List only; hide Board toggle.  
If user can only see contacts: allow Board + People list tab; hide Companies tab.

Do **not** invent new capability IDs in Phase 1. Optional later: `crm.accounts.view` as OR of existing caps (Phase 4).

## Files likely touched

| File | Change |
|------|--------|
| `src/app/navigation.ts` | Replace / merge `LBS_NAV_STANDALONE` Pipeline + `LBS_CLIENTS_NAV_ITEM` into single Accounts item (`to: "/accounts"`, `activePattern` covering `/accounts/*`, `/leads/*`, `/clients/*`, `/companies/*`, `/contacts/*` as needed for highlight) |
| `src/app/LbsCustomRoutes.tsx` | Add `/accounts` route; wire redirects from `/leads` list (careful: keep `/leads/:id/show`); adjust `/clients` if redirecting |
| `src/app/routing.ts` | Add `getAccountsHubPath(view?, tab?)`; update `getLeadsListPath` / `getClientsHubPath` to point at hub or keep aliases |
| **New** `src/modules/accounts/AccountsHubPage.tsx` (or `src/modules/clients/AccountsHubPage.tsx`) | Shell: title, List\|Board toggle, render children |
| **New** `src/modules/accounts/AccountsHubRoute.tsx` | Guard like `ClientsHubRoute.tsx` |
| **New** `src/modules/accounts/accountsHubSearchParams.ts` | Parse `view`, sync params (pattern from `clientsHubSearchParams.ts`) |
| `src/modules/clients/ClientsHubPage.tsx` | Embed under Accounts List **or** deprecate title “Clients” when embedded |
| `src/modules/leads/LeadsListPage.tsx` | Extract kanban/table body for embed **or** thin redirect when opened from hub; avoid double PageTitle |
| `src/components/atomic-crm/layout/Header.tsx` / sidebar consumers of `LBS_NAV_ITEMS` | Verify active states |
| Tests | Extend `clientsHubSearchParams.test.ts` patterns; add accounts hub param tests |

**Do not touch in Phase 1:** `dealsProvider.convertLeadToClient`, invoice/ticket/portal modules, RLS, migrations.

## Acceptance criteria

- [ ] Single primary nav label **Accounts** (English).
- [ ] `/accounts` loads hub with List|Board toggle.
- [ ] Board mode shows existing leads pipeline UI without stage-behavior changes.
- [ ] List mode shows existing Clients hub (Companies | People) or agreed interim.
- [ ] `/leads`, `/clients`, `/companies`, `/contacts` still work (redirect or alias).
- [ ] `/leads/:id/show`, `/companies/:id`, `/contacts/:id/show` unchanged.
- [ ] Companies-only / contacts-only identities see only allowed modes.
- [ ] `make typecheck` passes; no new DB migration files.

## No-regression checklist (Phase 1 slice)

See also full matrix in [05-accounts-hub-NO-REGRESSION-CHECKLIST.md](./05-accounts-hub-NO-REGRESSION-CHECKLIST.md).

| Check | Pass? |
|-------|-------|
| Create lead via `?create=lead` | |
| Create company via `?create=company` | |
| Create contact via `?create=contact` | |
| Open company show from list | |
| Open lead show from board/list | |
| Nav active highlight on `/companies/:id` and `/leads/:id/show` | |
| Dashboard / deep links using `getLeadsListPath` / `getClientsListPath` | |
| Mobile layout does not crash (MobileNavigation still contacts/companies oriented) | |

## Estimated effort

~1–2 engineering days (routing + shell + nav + tests), assuming embed of existing pages without redesign.

## Out of scope

- Nested company/contact list (Phase 2)
- Kanban refactor (Phase 3 polish)
- Spotlight / permission catalog renames (Phase 4)
