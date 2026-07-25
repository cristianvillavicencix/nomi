# Accounts hub — Rollback

Rollback strategy for Option A (UI hub). **No data migration** is performed in phases 1–4, so rollback is **code + config only**. Production data (`companies`, `contacts`, `lead_stage`, invoices, tickets) remains valid under either UI.

## Principles

1. Prefer **feature flag** or **nav revert** over emergency schema changes (there should be no schema changes).
2. Keep legacy routes (`/leads`, `/clients`, `/companies`, `/contacts`) working during rollout so rollback does not strand bookmarks.
3. Do not run reverse SQL. If a mistaken migration was added, treat it as an incident outside this plan.

## Recommended feature flag

Introduce a frontend flag (name illustrative):

```text
VITE_ACCOUNTS_HUB=1
```

| Value | Behavior |
|-------|----------|
| unset / `0` | Pre-hub nav: Pipeline + Clients; existing pages |
| `1` | Accounts hub shell and new list/board wiring |

Wire in:

- `src/app/navigation.ts` — which items are exported
- `src/app/LbsCustomRoutes.tsx` — whether `/accounts` exists and whether `/leads` redirects
- Optionally `AccountsHubPage` early-return → legacy pages

**Rollback = redeploy with flag off** (or remove flag from Vercel/env). No DB touch.

If the team prefers no env flag, use **git revert** of the hub PR(s) — same effect when routes are additive.

---

## Phase 1 — Nav shell

### What changed

- Accounts nav item; `/accounts` route; redirects from `/leads` list and/or `/clients`.
- Hub chrome List \| Board embedding existing pages.

### Rollback steps

1. Set `VITE_ACCOUNTS_HUB=0` **or** revert Phase 1 commit(s).
2. Restore `LBS_NAV_STANDALONE` Pipeline + `LBS_CLIENTS_NAV_ITEM` in `navigation.ts`.
3. Ensure `LbsCustomRoutes.tsx` again mounts `LeadsListPage` at `/leads` and `ClientsHubList` at `/clients` without forcing `/accounts`.
4. Redeploy frontend only.
5. Smoke: `/leads`, `/clients`, company/lead show.

### Data impact

None.

---

## Phase 2 — Company-grouped list

### What changed

- New grouped list component; Clients hub tabs may be demoted.

### Rollback steps

1. Point Accounts List mode back to `ClientsHubPage` (Companies \| People) — one-line host switch if flag/componentized.
2. Or disable hub flag (falls back to Phase 0 Clients hub via `/clients`).
3. Leave grouped list files in repo (dead code) or revert commit; unused UI is harmless.
4. Smoke: `/clients`, `/companies`, `/contacts`, create company/contact.

### Data impact

None. Nested list is read-only aggregation of existing rows.

---

## Phase 3 — Board reuse

### What changed

- `/leads` may redirect to `/accounts?view=board`; `LeadsListPage` extracted/embedded.

### Rollback steps

1. Remove redirect; mount `LeadsListPage` directly on `/leads` again.
2. Board mode in hub can 404-hide or unused.
3. Keep `storeKey="leads.listParams"` so user filters remain coherent either way.
4. Smoke: kanban stage change, convert won, `/leads/:id/show?stage=`.

### Data impact

None. Stage writes use the same `applyLeadStageChange` / `convertLeadToClient` paths.

---

## Phase 4 — Polish / permissions

### What changed

- Spotlight grouping, copy, optional permission **labels**, mobile nav, docs.

### Rollback steps

1. Revert Phase 4 commit(s) or flag-off copy branches.
2. If permission **IDs** were not changed (recommended), no role repair needed.
3. If a new capability was mistakenly required in the matrix, restore prior `permissionCatalog.ts` immediately and re-test invites/roles.

### Data impact

None. Docs-only parts need no rollback.

---

## Emergency: production incident during rollout

| Symptom | Action |
|---------|--------|
| 404 on `/leads` or `/clients` | Hotfix redirects or flag off; do not alter DB |
| Convert broken | Confirm `dealsProvider.convertLeadToClient` untouched; revert UI that wrapped it |
| Invoices missing company | Verify no code wrote `company_id` null; flag off UI; investigate write path — not list UI |
| RLS errors | Unrelated to hub UI; do not “fix” with schema drop |

---

## What rollback must never do

- Drop or merge `companies` / `contacts` tables
- Rewrite `client_invoices`, tickets, portal tokens
- Disable deal↔`lead_stage` triggers
- `supabase db reset` on hosted project

---

## Rollback verification checklist

After any rollback:

- [ ] Pipeline `/leads` list + kanban
- [ ] Clients `/clients` Companies \| People
- [ ] Company show + contact show + lead show
- [ ] Create invoice for a company
- [ ] Open one ticket linked to a company
- [ ] Convert one lead on staging (if convert was in the failed release)

---

## Mapping to deploys

| Phase PR | Rollback unit |
|----------|----------------|
| Phase 1 | Flag or revert nav/routes/shell |
| Phase 2 | Swap List body → `ClientsHubPage` |
| Phase 3 | Restore `/leads` → `LeadsListPage` |
| Phase 4 | Revert polish commit |

Keep PRs **phase-scoped** so revert stays surgical (see also Cursor skill `split-to-prs` if splitting a large branch).
