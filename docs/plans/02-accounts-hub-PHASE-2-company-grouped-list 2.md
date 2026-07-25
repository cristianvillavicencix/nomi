# Phase 2 — Company-grouped list

**Status:** Superseded for product UX by [accounts-hub-DESIGN-DECISION.md](./accounts-hub-DESIGN-DECISION.md) (People-only List + company preview). Kept as historical Phase 2 plan.  
**Risk:** Medium (performance + empty states)  
**Depends on:** Phase 1 hub shell (List mode host)  
**Parallel with:** Phase 3 (Board) after Phase 1  
**DB migrations:** None

## Goal

Replace (or supersede) the Clients hub **Companies | People** dual lists with a **single company-first list**: each row is a bill-to company; **representatives (contacts) nest underneath**. Leads without `company_id` appear in an explicit **“No company”** section. Filters distinguish pipeline vs clients without merging tables.

## Product behavior

### Row model

| Row type | Source | Click target |
|----------|--------|--------------|
| Company (parent) | `companies` / `companies_summary` | `getClientShowPath(id)` → `/companies/:id` |
| Contact (child) | `contacts` where `company_id` = parent | `getPersonShowPath(contact)` → lead or contact show |
| Orphan lead | `contacts` with null `company_id` and lead lifecycle status | `getLeadShowPath(id)` |

Bill-to for invoices/tickets/deals remains **`company_id`** — list UI must never imply a contact is bill-to.

### Nested contacts display

- Show primary contact first when `companies.primary_contact_id` matches (field already on summary/profile types: `CompanyWithPrimaryContact` in `clientProfile.ts`).
- Show other linked contacts (cap expand: e.g. first 5 + “Show more”).
- Optional badges: lead stage label (`getLeadStageDef`), status (lead vs client directory) from `contactStatus` constants in `src/modules/constants/contactStatus` (exported via `navigation.ts`).

### Filters (query-string / List filter objects)

Reuse PostgREST **Option A** filters only (`@in` allow-lists — never `@nin`). See `docs/audit/20-data-provider.md`.

Suggested filter chips:

| Filter | Meaning | Implementation sketch |
|--------|---------|------------------------|
| All accounts | Companies list default | `getList("companies", …)` |
| Pipeline | Companies that have ≥1 open-pipeline contact **or** show orphan section | Contact subquery / two-step fetch; avoid DB view unless later approved |
| Clients | Companies with client-status contacts or “has won/converted” — define precisely in PR | Prefer existing status constants `LBS_CLIENT_STATUS` / directory statuses |
| Search | Name match on company; optionally contact name | Company `q` / `name@ilike`; secondary contact search |

Do **not** require a new SQL view for Phase 2. If performance demands it later, that is a **separate** migration proposal outside this hub plan.

### Empty / edge states

| Case | UI |
|------|----|
| No companies | Empty state + “New company” / “New lead” CTAs |
| Company with zero contacts | Parent row + muted “No people yet” + add contact |
| Orphan leads only | “No company” section above or below main list |
| Filter yields zero | Clear filters CTA |

### Relationship to existing Clients hub tabs

Phase 2 **replaces** Companies | People as the default List experience inside Accounts.

- Keep `/contacts` and `/companies` aliases working (redirect to `/accounts?view=list` with optional filter, or mount the same grouped list).
- People-only flat list can remain behind a secondary control (“Flat people directory”) **only if** needed for power users — default is company-grouped.

## Data fetching strategy

### Preferred approach (no schema change)

1. **Parent page:** `<List resource="companies">` (dataProvider already remaps list to `companies_summary` — see `dataProvider.ts` and `src/lib/queryCache.ts`).
2. **Children:** After parent page loads, `useGetList("contacts", { filter: { "company_id@in": "(id1,id2,…)" }, pagination: { page: 1, perPage: N } })` batched for visible company IDs.
3. **Orphans:** Separate `useGetList("contacts", { filter: lead statuses + `company_id@is` null or missing })` — confirm FakeRest/Supabase adapter support for null filters before coding; if null operator unsupported, use positive allow-list of known orphan IDs from a small RPC **only if already exists** — otherwise fetch lead contacts and filter client-side for `!company_id` with a documented perPage cap.

### Reuse existing modules

| Asset | Use |
|-------|-----|
| `CompaniesListPage.tsx` | Column patterns, avatars, create dialog hooks — extract shared cells |
| `ContactsListPage.tsx` | Status filters, person display helpers |
| `companyChannelResolvers.ts` | Email/phone on parent row |
| `clientShowUtils.ts` | `getContactFullName`, phones |
| `Avatar` / `CompanyAvatar` | Visual consistency |

### Performance notes

- Cap nested fetch to **current page** company IDs only (25 companies × contacts).
- Debounce search; do not refetch children on unrelated sort toggles without need.
- Prefer one contacts `getList` with `@in` over N per-company requests.
- Watch React Query cache keys (`queryCache.ts` companies ↔ `companies_summary`).
- If list feels slow: measure before adding views; document metrics in PR.

## Files likely touched

| File | Change |
|------|--------|
| **New** `src/modules/accounts/AccountsGroupedList.tsx` (name flexible) | Company-first UI |
| **New** `src/modules/accounts/useCompanyNestedContacts.ts` | Batch fetch helper |
| `src/modules/accounts/AccountsHubPage.tsx` | List mode renders grouped list |
| `src/modules/clients/CompaniesListPage.tsx` | Extract shared row bits or deprecate as default |
| `src/modules/clients/ClientsHubPage.tsx` | Stop being default List body (or become thin wrapper) |
| `src/app/routing.ts` | List deep-link helpers |
| `src/modules/clients/clientsHubSearchParams.ts` | Possibly superseded by accounts params |
| Tests | Grouping, orphan section, filter allow-lists |

**Do not change:** invoice/ticket FK usage, `convertLeadToClient`, Kanban stage writers.

## Acceptance criteria

- [ ] List mode shows companies as primary rows with nested contacts.
- [ ] Click company → `/companies/:id`; click person → correct lead/contact show path.
- [ ] Orphan leads visible under “No company”.
- [ ] Filters use `@in` (or other supported ops) only — no `@nin`.
- [ ] Page of 25 companies does not fire 25 sequential contact requests (batch `@in`).
- [ ] Create company / create contact / create lead entry points still work from hub actions.
- [ ] FakeRest demo mode still loads (or document gap).
- [ ] No DB migration.

## Estimated effort

~3–5 engineering days (UI + fetching + filters + edge cases).

## Risks specific to this phase

| Risk | Mitigation |
|------|------------|
| Orphan null filter unsupported | Client-side filter with cap + notify if truncated |
| Users miss flat People directory | Temporary secondary link to legacy people list |
| Primary contact duplication in nest | Dedupe by id; pin primary |
