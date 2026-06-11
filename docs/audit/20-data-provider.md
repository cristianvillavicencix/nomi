# Data Provider Layer

> **Priority doc for batch 2.** Use this to plan filter-operator fixes and `.single()` / `.maybeSingle()` changes without breaking other modules.

## 1. Purpose

Central data access for Nomi CRM: wraps **ra-supabase-core** → **@raphiniert/ra-data-postgrest** for production, and **FakeRest + filter adapter** for demo mode. Adds custom methods (edge functions, scoped tasks, client upsert, billing, etc.) and lifecycle callbacks.

## 2. Files & components

| File | Role |
|------|------|
| `src/components/atomic-crm/providers/supabase/dataProvider.ts` | Production provider (~3.5k LOC) |
| `src/components/atomic-crm/providers/fakerest/dataProvider.ts` | Demo provider |
| `src/components/atomic-crm/providers/fakerest/internal/transformFilter.ts` | FakeRest-only operator → FakeRest syntax |
| `src/components/atomic-crm/providers/fakerest/internal/supabaseAdapter.ts` | Wraps FakeRest `getList` with `transformFilter` |
| `node_modules/@raphiniert/ra-data-postgrest/src/urlBuilder.ts` | **Production** filter → PostgREST query params |
| `node_modules/ra-supabase-core/lib/dataProvider.js` | Thin wrapper around ra-data-postgrest + auth HTTP client |
| `src/lib/isValidRecordId.ts` | Guards invalid `getOne` ids |

**Entry wiring:** `CRM.tsx` selects Supabase or FakeRest provider based on env.

---

## 3. Filter operator serialization (production)

### Pipeline

```
React-Admin List filter: { "field@operator": value }
        ↓
baseDataProvider.getList (ra-data-postgrest parseFilters)
        ↓
PostgREST query: ?field=operator.value
        ↓
Supabase REST / PostgreSQL
```

**FakeRest demo mode** inserts `withSupabaseFilterAdapter` → `transformFilter()` **before** FakeRest — different syntax (`field_eq`, `field_eq_any`, etc.). Fixes to production serialization **do not** automatically apply to demo unless `transformFilter.ts` is updated too.

### Operator matrix (production — ra-data-postgrest)

| App filter key | Example value | PostgREST param | Notes |
|----------------|---------------|-----------------|-------|
| `field@eq` | `"42"` | `field=eq.42` | Default when no `@op` suffix |
| `field@neq` | `"x"` | `field=neq.x` | |
| `field@lt` / `@lte` / `@gt` / `@gte` | `"2024-01-01"` | `field=lt.…` etc. | |
| `field@in` | `("a","b")` | `field=in.(a,b)` | **Must** be parenthesized string; see `statusInFilter()` |
| `field@is` | `null` | `field=is.null` | Used for null checks |
| `field@not.is` | `null` | Parsed as op `not.is` → **`not.is.null`** | **Only first `@` splits** — see pitfalls |
| `field@ilike` | `"acme"` | `field=ilike.*acme*` | Library wraps with `*` wildcards |
| `field@like` | `"acme"` | `field=like.*acme*` | Same wrapping |
| `field@cs` | `{123}` | `field=cs.{123}` | Postgres `@>` / contains |
| `@or` | `{ "a@ilike": "x", "b@ilike": "x" }` | `or=(a.ilike.*x*,b.ilike.*x*)` | Nested filters re-parsed |
| `field@fts` etc. | — | Supported if used | Listed in postgrestOperators |

**Not supported by ra-data-postgrest (will produce invalid PostgREST):**

| App filter key | What happens | PostgREST expects |
|----------------|--------------|-------------------|
| `field@nin` | `field=nin.(…)` | **`not.in.(…)`** — `nin` is not a PostgREST operator |
| `field@not.in` | Op parsed as `not.in` → `field=not.in.(…)` | May work **if** value format is correct `(a,b)` |
| Multi-segment ops like `field@not@in` | Not supported | N/A |

Source: `@raphiniert/ra-data-postgrest` `parseFilters()` — splits key on **first `@` only** (`urlBuilder.ts:100-104`).

### Operator matrix (FakeRest demo — transformFilter.ts)

| App filter key | Transformed FakeRest key | Notes |
|----------------|------------------------|-------|
| `field@eq` / `@neq` / `@lt` / `@lte` / `@gt` / `@gte` | `field_eq`, `field_neq`, … | |
| `field@is` | `field_eq: null` | |
| `field@not.is` | `field_neq: null` | |
| `field@in` | `field_eq_any: [...]` | Parsed via `transformInFilter` |
| `field@cs` | `field: [...]` | Parsed via `transformContainsFilter` |
| `@or` | `q: …` | First branch only (`transformOrFilter`) |
| **`field@nin`**, **`field@not.in`**, **`field@ilike`** | **Passed through unchanged** | FakeRest may ignore unknown keys → **silent wrong results in demo** |

---

## 4. Known `@nin` / `@not.in` usage in codebase

| Location | Current usage | Status |
|----------|---------------|--------|
| `src/lbs/deals/openDealFilters.ts` | `"stage@in": statusInFilter(openStages)` | **Fixed** (was `@nin` — caused PostgREST 400) |
| `src/lbs/leads/LeadsListPage.tsx` | `LEGACY_FOLLOW_UP_FILTER_KEYS` includes `@nin` / `@not.in` | **Cleanup only** — keys stripped from persisted list filters, not active queries |
| Docs / plans | `PLAN_FASE_1.md`, audit notes | Historical reference |

**Consumers of open-deals filter (all use `@in` now):**

- `ClientRelatedSidebar.tsx`, `ContactRelatedSidebar.tsx`
- `useClientTabCounts.ts`, `useContactTabCounts.ts`
- `ClientOpenDealsTab` / deal tab panels

**If you add `@nin` / negated `@in` elsewhere:** every `getList` / `getManyReference` on Supabase will 400 until serialization is fixed.

### Confirmed strategy (approved 2026-06-02)

**Option A — positive `@in` allow-lists only.** Do **not** add `@nin` mapping, `@not.in` support, or patch `@raphiniert/ra-data-postgrest`. Compute allow-lists in TypeScript (pattern: `openDealFilters.ts` + `statusInFilter()`).

| Rejected | Reason |
|----------|--------|
| Option B (pre-processor for `@nin`) | Out of scope; negation via allow-list is sufficient |
| Option C (fork ra-data-postgrest) | Upgrade friction |
| Option D (per-resource intercept) | Inconsistent maintenance |

### Queued for fix phase (data layer)

| Item | File(s) | Action |
|------|---------|--------|
| Remove manual `%` in `@ilike` filters | `BillToClientSearch.tsx`, `submissionFilterUtils.ts` | Drop `%` wrappers; ra-data-postgrest adds `*` wildcards |
| Extend `isValidRecordId` guards | Proposals, deals, contracts Show pages / hooks | Mirror contacts pattern; prevent PostgREST 406 on empty route ids |
| Legacy `@nin` keys | `LeadsListPage.tsx` `LEGACY_FOLLOW_UP_FILTER_KEYS` | Keep stripping from persisted filters; never reintroduce `@nin` queries |

### Reference: rejected alternatives (planning archive)

| Option | Scope | Risk |
|--------|-------|------|
| **A. Positive `@in` only** ✅ **SELECTED** | Compute allow-list in TS | Low — already proven |
| **B. Extend `transformFilter` + wrap production `getList`** | Map `@nin` → `@not.in` | Medium |
| **C. Fork/patch ra-data-postgrest** | Add `nin` alias | High |
| **D. Custom `getList` wrapper** | Intercept known resources/fields | Low scope but inconsistent |

**Value format for `@in`:** always use `statusInFilter()` / `relatedFilters.ts`:

```ts
// ("lead","prospect")  — quoted strings for text enums
`(${statuses.map((s) => `"${s}"`).join(",")})`
```

Empty list edge case: `@in` with `()` — ra-data-postgrest passes `in.()` which may error; several call sites use `deal_id@eq: -1` as impossible filter when ID list is empty.

---

## 5. `@ilike` and search

### Global contact search (lifecycle callback)

`applyContactListSearch` / `applyFullTextSearch` in `dataProvider.ts` (~3460+):

- Multi-word: `first_name@ilike` + `last_name@ilike` (AND)
- Single token: `@or` with `email_fts@ilike`, `phone_fts@ilike`, column `@ilike`
- Values passed through `normalizePostgrestIlikeQuery()` — **without** manual `%`

ra-data-postgrest then wraps: `ilike.*value*`.

### Manual `%` wrappers (inconsistent)

| File | Pattern | Risk |
|------|---------|------|
| `BillToClientSearch.tsx` | `"name@ilike": \`%${q}%\`` | Double wildcards → `ilike.*%q%*` |
| `submissionFilterUtils.ts` | `utm_source@ilike: \`%${…}%\`` | Same |

**Fix planning:** remove manual `%` where ra-data-postgrest already wraps, or bypass library for those queries.

---

## 6. `getList` / `getOne` overrides

### Summary view redirect (`getList`)

| Resource requested | Queries table/view |
|--------------------|-------------------|
| `companies` | `companies_summary` |
| `contacts` | `contacts_summary` |
| `monitored_websites` | `monitored_websites_summary` |

Filters on summary views must use columns that exist on the view (not always identical to base table).

### `getOne` behavior

```476:519:src/components/atomic-crm/providers/supabase/dataProvider.ts
  async getOne(resource: string, params: any) {
    if (!isValidRecordId(params?.id)) {
      throw new Error(`Missing id for getOne(${resource})`);
    }
    // companies → companies_summary maybeSingle, fallback base
    // contacts → contacts_summary maybeSingle, then contacts maybeSingle
    // monitored_websites → monitored_websites_summary maybeSingle, fallback base
    return baseDataProvider.getOne(resource, params);
  },
```

| Resource | Invalid id (`""`, `undefined`) | 0 rows (RLS) | 1 row |
|----------|-------------------------------|--------------|-------|
| **All** | Throws before HTTP — **no 406** | contacts: throws "not found"; others: base provider error | OK |
| **contacts** | Guarded | `maybeSingle` → null → explicit error | summary or base |
| **companies**, **monitored_websites** | Guarded | Falls back to base `getOne` | summary preferred |

**baseDataProvider.getOne** uses PostgREST `Accept: application/vnd.pgrst.object+json` → **406** when 0 or 2+ rows. Contacts/companies/monitored_websites overrides exist partly to avoid 406 on RLS-empty reads.

### Bypass paths (not using `getOne` override)

| Method | Why |
|--------|-----|
| `getConfiguration()` | Anonymous routes; `maybeSingle` on `configuration` |
| `getScopedTasks()` | Direct Supabase client |
| Various upsert helpers | Direct client in same file |

---

## 7. `.single()` vs `.maybeSingle()` inventory

PostgREST behavior:

- **`.single()`** — expects exactly 1 row; **406** if 0 or multiple (with object+json accept).
- **`.maybeSingle()`** — 0 or 1 row OK; error if multiple.

### `dataProvider.ts` (production)

| Lines (approx) | Method | Op | Context | Safe if 0 rows? |
|----------------|--------|-----|---------|-----------------|
| 159 | `resolveOrganizationMemberId` | `.single()` | UUID → member id lookup | No — falls back to input id |
| 177 | `getCurrentMutationIdentity` | `.single()` | Auth user → member | Yes — returns null |
| 293 | `getOneFromResourceMaybeSingle` | `.maybeSingle()` | Summary view getOne | Yes |
| 314 | `patchSingletonConfigurationRow` | `.maybeSingle()` | Config update RLS | Throws custom error if null |
| 347, 417 | contact create/update | `.single()` | Load org member | Throws |
| 391 | contact company move | `.maybeSingle()` | Previous company primary | Yes |
| 602 | avatar-only member update | `.maybeSingle()` | Self avatar patch | Returns null row |
| 1204–1625 | `upsertLbsClient`, `createDeal`, `convertLeadToClient` | mix | Client/deal flows | `.maybeSingle()` for lookups; `.single()` after insert/update |
| 1931 | `getConfiguration` | `.maybeSingle()` | Public/login config read | Returns defaults |
| 1957 | `syncOrganizationPipelineStages` | `.single()` | Current member | Throws |
| 2710–2829 | messaging helpers | mix | Find/create conversation | `.maybeSingle()` for lookups; `.single()` on insert |

### Other `src/` files (direct Supabase client)

| File | Op | Notes |
|------|-----|-------|
| `authProvider.ts:78` | `.single()` | Member by user_id |
| `lbsContactUpsert.ts` | mix | Contact persist |
| `useWebsiteMonitorSettings.ts` | `.maybeSingle()` | Org settings |
| `WebsiteMonitorSettingsSection.tsx` | `.single()` | Update org row |
| `useOrganizationSmsSignature.ts` | `.single()` | Signature row |
| `useMaskedAmount.ts` | `.maybeSingle()` | Permission mask |
| `website-monitor/*` queries | `.maybeSingle()` | Audit/GSC reads |
| `FormSettingsSheet.tsx` | `.single()` | Form instance update |

### Consumers affected by changing `.single()` → `.maybeSingle()` on base `getOne`

| Consumer pattern | Impact if 0 rows become null instead of 406 |
|------------------|---------------------------------------------|
| `useGetOne("proposals", { id })` with bad id | Already guarded by `isValidRecordId` in places; still 406 if id valid but RLS denies |
| `ReferenceField` / `useRecordContext` | Empty UI vs error boundary |
| Show pages loading before redirect | Need explicit "not found" state |
| **Contacts show** | Custom path already throws friendly error |

**Consumers using `isValidRecordId` to disable queries (avoid bad id):**

- `useProposalDocumentData.ts`, `ProposalBuilderForm.tsx`, `ProposalCrmLinksCard.tsx`, `useProposalRecipient.ts`

**Not guarded:** other resources (proposals, deals, contracts) may still call `getOne` with empty id from route params during transitions.

---

## 8. Filter usage by module (representative)

| Operator | Example consumers |
|----------|-------------------|
| `@eq` | Tab counts, sidebars, billing filters |
| `@in` | Lead/contact status lists, open deals, id sets |
| `@cs` | `contact_ids@cs`, `assigned_member_ids@cs`, task arrays |
| `@neq` | `disabled@neq: true` (members) |
| `@lt` / `@lte` | Overdue invoices, follow-up dates |
| `@is` / `@not.is` | Unassigned contact, meetings filter |
| `@or` | Global search, BillToClientSearch |
| `@ilike` | Search, submissions UTM filter |

**Bypasses filter string layer entirely:**

- `getScopedTasks()` — Supabase JS `.eq`, `.in`, `.or`, `.is`
- `getActivityLog()` — multiple queries
- Analytics SQL in forms-v2

---

## 9. Impact analysis: fixing serialization

| Change | Modules affected | Test focus |
|--------|------------------|------------|
| Add `@nin` → `not.in` mapping | Any future negated enum filters; leads if follow-up filters reintroduced | Leads list, deals open filter |
| Fix `@ilike` `%` doubling | Billing search, form submissions | BillToClientSearch, submissions list |
| Wrap all `getList` filters | **Every** List/ReferenceMany | Full regression on tab counts + sidebars |
| Extend FakeRest `transformFilter` | Demo mode only | `make start-demo` lists |
| Global `getOne` maybeSingle | All Show pages | Proposals, contacts, contracts, deals |

### High-risk call sites (empty `@in` / impossible filters)

| Pattern | Files | Purpose |
|---------|-------|---------|
| `deal_id@eq: -1` | `useClientTabCounts`, `useContactTabCounts`, `ClientTabPanels` | No deals → empty related list |
| `contact_id@eq: -1` | Same | No contacts |
| `id@in: ()` | Avoid — prefer impossible eq | |

Changing `@in` serialization breaks tab counts across **Companies, Contacts, Clients** sidebars.

---

## 10. External / cron data paths (not via dataProvider)

| Trigger | Functions |
|---------|-----------|
| pg_cron (live DB) | `website_monitor_run`, `website_audit_schedule`, `process_invoice_payment_reminders`, `process_invoice_auto_charges` |
| Vercel cron | `process_scheduled_payments`, `process_scheduled_client_invoices` |
| Webhooks | Postmark, Stripe, Twilio, audit worker callback |

---

## 11. Status: PARTIAL

Production CRM works for current filter patterns (`@eq`, `@in`, `@cs`, `@or`, `@ilike` without manual `%` in most paths). Gaps: no `@nin`, inconsistent `@ilike`, demo adapter incomplete, `getOne` 406 on some resources with valid-but-denied ids.

## 12. Issues found

| Severity | Issue | Planning note |
|----------|-------|---------------|
| **HIGH** | `@nin` not valid PostgREST | Use `@in` allow-list or implement `not.in` mapping before use |
| **HIGH** | `getOne` 406 on proposals/contacts with empty route id | Extend `isValidRecordId` guards or maybeSingle for all Show pages |
| **MEDIUM** | FakeRest `transformFilter` ignores `@nin`/`@ilike` | Demo mode misleading for filter testing |
| **MEDIUM** | Manual `%` in `@ilike` | Audit BillToClientSearch + submissionFilterUtils |
| **LOW** | Spanish errors in `signUp` / comments | English copy cleanup |

## 13. Broken connections

- Open deals filter fixed to `@in` — related sidebars depend on `dealStages` + `dealPipelineStatuses` config being loaded.
- Summary view column mismatch can break filters if base-table field names used on `*_summary` resources.
