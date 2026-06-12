# Restructure Proposal (STEP 3)

**Date:** 2026-06-02  
**Status:** Phases B, C, E largely complete (2026-06). Phase D **cancelled**. Phase A optional docs remain.

---

## 1. Problem statement

Nomi has **two frontend layers** that evolved in parallel:

| Layer | Path | Role |
|-------|------|------|
| Generic CRM | `src/components/atomic-crm/` | Contacts, deals, tasks, settings shell (~15k LOC) |
| LBS product | `src/lbs/` | Agency modules: proposals, billing, web monitor, forms v2 |

This split causes:

- **Duplicate domain logic** — deals/project flows span both `atomic-crm/deals` and `lbs/deals`, `lbs/projects`
- **God files** — `dataProvider.ts` (~3.5k LOC), `CRM.tsx`, `SettingsPage.tsx`
- **Naming drift** — Companies vs Clients, Deals vs Projects, `/clients/*` legacy redirects
- **Navigation fragmentation** — Forms v2 and Reports lack sidebar entries; Settings embeds forms list
- **Mobile/desktop divergence** — `MobileAdmin` omits all LBS custom routes

---

## 2. Goals

1. **One obvious place** per product domain (leads, clients, revenue, ops, tools).
2. **Smaller dataProvider** — extract edge-function clients and domain mutations by module.
3. **Consistent naming** — English UI; “Company” in nav matches `companies` resource.
4. **Preserve mutable deps** — keep `src/components/admin/` and `src/components/ui/` as documented customization points.

---

## 3. Proposed target layout

Phased migration — **do not big-bang rename**.

```
src/
├── app/                          # NEW: shell only
│   ├── CRM.tsx                   # move from atomic-crm/root (thin router)
│   ├── LbsCustomRoutes.tsx       # move from lbs/
│   └── navigation.ts             # move from lbs/
│
├── modules/                      # NEW: product domains (rename from lbs/ + split atomic-crm)
│   ├── dashboard/
│   ├── leads/
│   ├── clients/                  # companies + contacts + client show tabs
│   ├── deals/                    # pipeline + project delivery (merge lbs/deals + lbs/projects)
│   ├── proposals/
│   ├── contracts/
│   ├── billing/
│   ├── tasks/
│   ├── calendar/
│   ├── messages/
│   ├── tickets/
│   ├── web-monitor/
│   ├── forms/
│   └── reports/
│
├── platform/                     # NEW: generic CRM infra (from atomic-crm)
│   ├── layout/
│   ├── login/
│   ├── settings/                 # shell only; module sections stay co-located or in modules/*/settings
│   ├── providers/
│   │   ├── supabase/
│   │   │   ├── dataProvider.ts   # thin facade
│   │   │   ├── modules/          # billingProvider.ts, proposalsProvider.ts, …
│   │   │   └── authProvider.ts
│   │   └── fakerest/
│   └── types/
│
├── components/
│   ├── admin/                    # unchanged (mutable dep)
│   └── ui/                       # unchanged (mutable dep)
│
└── lib/                          # shared utils (isValidRecordId, googlePlaces, …)
```

**Backend** stays `supabase/` + `workers/` + `api/cron/` — no restructure required beyond grouping edge functions in docs.

---

## 4. Recommended phases

### Phase A — Documentation & aliases (low risk)

- Add `docs/architecture/modules.md` mapping old → new paths.
- Add path aliases in `tsconfig.json` only when folders exist (`@/modules/*`).
- No file moves.

### Phase B — Extract dataProvider modules (medium risk)

Split `dataProvider.ts` custom methods into:

| Module file | Methods |
|-------------|---------|
| `billingProvider.ts` | Client invoice CRUD, Stripe, share/send |
| `proposalsProvider.ts` | Send proposal, public flows |
| `messagingProvider.ts` | SMS, conversations |
| `webMonitorProvider.ts` | Monitor sync, audit enqueue |
| `formsProvider.ts` | Token, submit, events |
| `orgProvider.ts` | Users, pipeline stages, configuration |

Keep single exported `dataProvider` that spreads `baseDataProvider` + module extensions.

### Phase C — Move LBS into `modules/` (medium risk)

1. `src/lbs/deals` + `src/lbs/projects` → `src/modules/deals`
2. Remaining `src/lbs/*` → matching `src/modules/*`
3. Update imports; leave re-export shims in `src/lbs/` for one release if needed.

### Phase D — Consolidate atomic-crm (higher risk) — **CANCELLED**

**Status (2026-06): cancelled — not deferred.**

Phase D cancelled (2026-06): cosmetic only, no runtime impact, and `src/modules/` already contains the merged LBS domains — merging atomic-crm directories on top would risk regressions for zero user benefit. `atomic-crm/` paths are stable and permanent.

Originally: move `atomic-crm/contacts`, `companies`, `deals`, `tasks` into `modules/clients` and `modules/deals`. Keep `platform/layout`, `platform/login`, providers. **Do not execute** — future agents should not attempt this phase without explicit product approval.

### Phase E — Router & mobile parity

- Single `renderCustomRoutes()` used by desktop **and** mobile (feature-flag heavy modules).
- Collapse legacy redirects (`/clients/*`, `/web-forms`, `/people/*`) after analytics confirm zero traffic.

---

## 5. What NOT to restructure yet

| Item | Reason |
|------|--------|
| `src/components/admin/`, `ui/` | Mutable deps — intentional |
| Database table names | High migration cost; views already abstract reads |
| Edge function folder names | Deploy scripts and Supabase CLI expect current names |
| FakeRest provider | Must mirror Supabase module split when Phase B completes |

---

## 6. Naming conventions (post-restructure)

**Approved 2026-06-02 (fix phase).** Applies during restructure — **do not rename files/routes yet.**

| Concept | UI / nav / filters / copy | Resource / table |
|---------|---------------------------|------------------|
| Client company | **Company** | `companies` |
| Person | **Contact** | `contacts` |
| Sales pipeline item | **Deal** (single term in nav, filters, and user-facing copy) | `deals` |
| Won-deal delivery workspace | **Project** — only inside delivery tabs of a won deal | same `deals` row |
| Lead | **Lead** | `contacts` with lead status filter |

**Rule:** Say **Deal** in sidebar, kanban, open-deals filters, and pipeline copy. Reserve **Project** for post-win delivery tabs (`ProjectWorkspaceTabs`, brief/launch/delivery UI) — not for top-level navigation.

---

## 7. Success metrics

- `dataProvider.ts` under **800 LOC** (facade + lifecycle only). ✅ Achieved 2026-06 — helpers extracted to `dataProviderWriteHelpers.ts` and `dataProviderSearch.ts`.
- Zero imports from `src/lbs/` after Phase C (or shims only). ✅
- All product modules discoverable from sidebar (including Reports under Tools). ✅
- Mobile admin reaches messages + calendar OR explicit “desktop only” banner. ✅

---

## 8. Approval

Restructure is **optional** and **post-fix-phase**. Approve Phase B first (dataProvider split) — highest ROI, lowest user-visible churn.
