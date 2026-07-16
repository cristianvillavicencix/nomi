# Nomi CRM — module map

**Last updated:** 2026-07-16 (Accounts hub Option A)

Living reference for how the codebase is laid out today and where the
old `src/lbs/` + `src/components/atomic-crm/` paths now live. Read this
before searching for "where is X" or proposing further moves.

### Accounts hub (UI only — no schema merge)

With `VITE_ACCOUNTS_HUB=1`, the primary nav entry is **Accounts** (`/accounts`):
List = company-first nested contacts; Board = existing leads Kanban
(`contacts.lead_stage`). Tables remain `companies` + `contacts`. Legacy
URLs `/leads`, `/clients`, `/companies`, `/contacts` redirect or alias the
hub. See `docs/plans/00-accounts-hub-OVERVIEW.md`. Rollback:
`VITE_ACCOUNTS_HUB=0` (no DB undo).

---

## 1. Top-level layout

```
src/
├── app/                          # CRM shell wiring
│   ├── LbsCustomRoutes.tsx       # All product routes (was src/lbs/LbsCustomRoutes.tsx)
│   ├── LbsSidebarNav.tsx         # Sidebar nav links (was src/lbs/LbsSidebarNav.tsx)
│   ├── navigation.ts             # Module metadata used by sidebar + module info popover
│   └── routing.ts                # Shared route helpers (getClientDealCreatePath, …)
│
├── modules/                      # LBS product modules (was src/lbs/)
│   ├── accounts/                 # Accounts hub (Option A UI over companies + contacts)
│   ├── billing/                  # Client invoices, Stripe flows, public payment
│   ├── calendar/                 # Calendar page
│   ├── catalog/                  # Service packages + addons seeds
│   ├── clients/                  # Companies + client show tabs (LBS-flavoured)
│   ├── constants/                # Shared LBS constants (lead source removed in cleanup)
│   ├── contacts/                 # Contact show, related sidebar, quick actions
│   ├── contracts/                # Contracts list + show
│   ├── dashboard/                # LBS dashboard widgets
│   ├── deals/                    # Deal board, NewDealDialog, project workspace
│   │   └── projects/             # Project delivery tabs (won-deal workspace)
│   ├── forms/                    # Forms v2 list, builder, submissions, analytics
│   ├── leads/                    # Leads list, create, show, Kanban board panel
│   ├── meetings/                 # Meetings page
│   ├── messages/                 # Messages inbox, SMS, conversations, dialer
│   ├── portal/                   # Client portal (public)
│   ├── proposals/                # Proposals editor, public view, document/
│   ├── settings/                 # Module-specific settings sections
│   ├── shared/                   # Shared LBS UI (ContactActivityFeed, etc.)
│   ├── tickets/                  # Tickets list + show + create
│   ├── types.ts                  # LBS-wide types
│   ├── web-forms/                # Public form entry, project resources upload
│   └── web-monitor/              # Website monitor + audit pages
│
├── components/
│   ├── admin/                    # shadcn-admin-kit framework (mutable dep — modify directly)
│   ├── atomic-crm/               # Generic CRM (mutable dep — modify directly)
│   │   ├── activity/             # Activity logs (DealCreated, etc.)
│   │   ├── companies/            # Resource: CompanyList/Show/Edit/Create + barrel
│   │   ├── contacts/             # Resource: ContactList/Show/Edit/Create + merge/import
│   │   ├── dashboard/            # Dashboard.tsx shell (HotContacts, DealsChart, Welcome)
│   │   ├── deals/                # DealList lazy resource + Kanban + project flows
│   │   ├── filters/              # ra-data-postgrest filter helpers
│   │   ├── layout/               # DesktopLayout, MobileLayout, sidebars, topbar
│   │   ├── login/                # LoginPage, ForgotPassword, StartPage (SignupPage KEEP)
│   │   ├── misc/                 # Shared utilities (ContactImportButton, etc.)
│   │   ├── notes/                # Notes UI (NoteCreate, NotesIterator, …)
│   │   ├── organizationMembers/  # Sales* removed — only RedirectToSettingsUsers left
│   │   ├── providers/            # Data + auth providers (see §2)
│   │   ├── root/                 # CRM.tsx, ConfigurationContext, defaultConfiguration
│   │   ├── settings/             # SettingsPage shell, ProfilePage, sections
│   │   ├── simple-list/          # SimpleList + sub-components (used by HotContacts)
│   │   ├── tags/                 # Tag UI
│   │   └── tasks/                # TaskList resource + mobile + filters
│   ├── avatar/                   # Avatar utilities
│   ├── supabase/                 # Supabase-specific auth pages
│   └── ui/                       # shadcn UI components (mutable dep — modify directly)
│
├── hooks/                        # Shared React hooks
├── lib/                          # Shared utils (isValidRecordId, googlePlaces, permissions/…)
├── reports/                      # Reports module (ReportsPage + WebAgencyMetricsReportPage)
└── App.tsx                       # Application entry — renders <CRM>
```

`src/platform/` exists empty: reserved by the restructure proposal but
**not adopted**. Providers, layout, login, settings stay in
`src/components/atomic-crm/` (mutable dependency). Do not move them
without explicit product approval.

---

## 2. Data provider split (P5-B)

`dataProvider.ts` is a thin facade (~595 LOC, target was <800).
Module providers live next to it under `providers/supabase/modules/`:

| Module file | Owns |
|-------------|------|
| `billingProvider.ts` | Client invoice CRUD, Stripe, share/send |
| `dealsProvider.ts` | Deal mutations (stages, secrets, github status, …) |
| `formsProvider.ts` | Forms v2 token, submit, events |
| `messagingProvider.ts` | SMS, conversations |
| `orgProvider.ts` | Users, pipeline stages, configuration |
| `proposalsProvider.ts` | Send proposal, public flows |
| `webMonitorProvider.ts` | Monitor sync, audit enqueue |
| `uploadToBucket.ts` | Shared storage helper |

Helpers extracted out of the facade:
- `dataProviderWriteHelpers.ts` — common write transforms
- `dataProviderSearch.ts` — search/filter helpers
- `invokeEdgeFunction.ts` — typed Edge Function caller

---

## 3. Old → new path mapping

Quick reference for code searches and PRs. Path on the left has been
removed; path on the right is current.

### `src/lbs/` (Phase C/E — fully removed 2026-06)

| Old path | New path |
|----------|----------|
| `src/lbs/LbsCustomRoutes.tsx` | `src/app/LbsCustomRoutes.tsx` |
| `src/lbs/LbsSidebarNav.tsx` | `src/app/LbsSidebarNav.tsx` |
| `src/lbs/navigation.ts` | `src/app/navigation.ts` |
| `src/lbs/billing/*` | `src/modules/billing/*` |
| `src/lbs/calendar/*` | `src/modules/calendar/*` |
| `src/lbs/clients/*` | `src/modules/clients/*` |
| `src/lbs/contacts/*` | `src/modules/contacts/*` |
| `src/lbs/contracts/*` | `src/modules/contracts/*` |
| `src/lbs/deals/*` + `src/lbs/projects/*` | `src/modules/deals/*` (projects/ inside) |
| `src/lbs/forms/*` | `src/modules/forms/*` |
| `src/lbs/leads/*` | `src/modules/leads/*` |
| `src/lbs/meetings/*` | `src/modules/meetings/*` |
| `src/lbs/messages/*` | `src/modules/messages/*` |
| `src/lbs/portal/*` | `src/modules/portal/*` |
| `src/lbs/proposals/*` | `src/modules/proposals/*` |
| `src/lbs/tickets/*` | `src/modules/tickets/*` |
| `src/lbs/web-forms/*` | `src/modules/web-forms/*` |
| `src/lbs/web-monitor/*` | `src/modules/web-monitor/*` |
| `src/lbs/settings/*` | `src/modules/settings/*` |
| `src/lbs/shared/*` | `src/modules/shared/*` |
| `src/lbs/catalog/*` | `src/modules/catalog/*` |
| `src/lbs/constants/*` | `src/modules/constants/*` |
| `src/lbs/dashboard/*` | `src/modules/dashboard/*` |
| `src/lbs/ModulePlaceholderPage.tsx` | **deleted** (P3 cleanup) |
| `src/lbs/placeholders.tsx` | **deleted** (P3 cleanup) |

### dataProvider split (P5-B — 2026-06)

| Old location | New location |
|--------------|--------------|
| `dataProvider.ts` (>3500 LOC) | `dataProvider.ts` (<800 LOC facade) |
| Inline billing methods | `providers/supabase/modules/billingProvider.ts` |
| Inline proposals methods | `providers/supabase/modules/proposalsProvider.ts` |
| Inline messaging methods | `providers/supabase/modules/messagingProvider.ts` |
| Inline web monitor methods | `providers/supabase/modules/webMonitorProvider.ts` |
| Inline forms methods | `providers/supabase/modules/formsProvider.ts` |
| Inline org/users methods | `providers/supabase/modules/orgProvider.ts` |
| Inline deals methods | `providers/supabase/modules/dealsProvider.ts` |
| Inline write helpers | `dataProviderWriteHelpers.ts` |
| Inline search helpers | `dataProviderSearch.ts` |

### Orphan/dead code removed (P3 + cleanup sweep — 2026-06)

| Removed | Why |
|---------|-----|
| `atomic-crm/contacts/ContactQuickViewPage.tsx` | no route, no callers |
| `atomic-crm/companies/CompanyQuickViewPage.tsx` | no route, no callers |
| `atomic-crm/companies/{CompanyCard,GridList,CompanyListFilter}.tsx` | superseded by modules/clients/* |
| `atomic-crm/contacts/{ContactAside,Personal,Background,Tasks,Merge,EditSheet,ExportVCard}*` | superseded by modules/clients/* + modules/contacts/* |
| `atomic-crm/deals/{DealCreate,DealEmpty,DealListContent,OnlyMineInput,projectAssignments,dealUtils}.tsx` | superseded by modules/deals/* |
| `atomic-crm/dashboard/{DealsPipeline,LatestNotes,TasksListEmpty,TasksListFilter}.tsx` | superseded by modules/dashboard/* |
| `atomic-crm/misc/{ImportPage,ImportFromJsonButton,useImportFromJson}.tsx` | `/import` flow removed |
| `atomic-crm/login/SignupPage.tsx` | **KEPT** — route disabled, code stays per product decision |
| `atomic-crm/organizationMembers/{SalesList,SalesCreate,SalesEdit,SalesInputs}.tsx` | only RedirectToSettingsUsers active |
| `atomic-crm/tasks/{TasksListContent,TasksIterator,taskFilters}.tsx` | superseded by modules/* |
| `atomic-crm/layout/QuickMasterDetailLayout.tsx` | unused |
| `lbs/billing/StandaloneInvoiceShowPage.tsx` | `/billing?invoice=` workspace replaces it |
| `lbs/placeholders.tsx` + `LBS_PLACEHOLDER_MODULES` | feature flags resolved |
| `modules/clients/{ClientProfileHeader,ClientOverviewTab,ClientInformacionTab,ClientSectionNav,ClientNewMenu,ClientExtraEmailsIndicator}.tsx` | superseded versions in modules/clients/Client*Page.tsx |
| `modules/messages/{MessagesDock,MessagesInboxPanel,MessagesIncomingBanner,New{ClientSms,DirectMessage}Dialog}.tsx` | superseded by MessagesPage chain |
| `modules/messages/{tags/TagInput,dialer/DialerPanel}.tsx` | unused |
| `modules/proposals/{ProposalShow,ProposalPreviewDialog,ProposalLineItemsEditor,ProposalPaymentSchedulePanel,ProposalTotalsSummary}.tsx` | superseded by ProposalViewPage + ProposalEdit |
| `modules/proposals/document/{ProposalDeckSections,ProposalSectionImageField,proposalPdfTheme}` | superseded by ProposalPreviewPage / proposal document pipeline |
| `modules/web-monitor/audit/{WebsiteAuditCwvPanel,WebsiteAuditHtmlDialog,WebsiteAuditLinkTreeView,LabMetricGauge,websiteAuditLinkTree}` | superseded by current panel set |
| `modules/web-forms/{PublicFormPage,PublicCustomForm,PublicProjectResourcesForm}.tsx` | live route uses `FormPublicEntry` |
| `reports/ReportFilters.tsx` | unused |
| `hooks/{useStateFormDraft,simple-form-iterator-context}.tsx` | ra-core supplies the hooks now |
| `lib/permissions/"amountMasking 2.ts"` | macOS conflict-copy duplicate of `amountMasking.ts` |

---

## 4. What stays where (intentional)

| Item | Path | Reason |
|------|------|--------|
| shadcn-admin-kit components | `src/components/admin/` | Mutable dep — modify directly |
| shadcn UI primitives | `src/components/ui/` | Mutable dep — modify directly |
| Generic CRM resources (companies/contacts/deals/tasks/notes) | `src/components/atomic-crm/` | Phase D cancelled — too risky for zero user benefit |
| Data providers | `src/components/atomic-crm/providers/` | Co-located with atomic-crm |
| Layout, login, settings shell | `src/components/atomic-crm/{layout,login,settings,root}` | Phase D cancelled |
| Reports | `src/reports/` | Top-level — small, standalone module |
| Backend (supabase functions, migrations) | `supabase/` | Deploy scripts expect these paths |
| Cloud Run worker | `workers/web-audit/` | External worker |

---

## 5. What NOT to do

- **Do not** attempt to move `src/components/atomic-crm/{contacts,companies,deals,tasks}` into `src/modules/clients/` or `src/modules/deals/`. Phase D was cancelled — see `docs/audit/RESTRUCTURE-PROPOSAL.md` §4.
- **Do not** rename database tables, edge function folders, or `companies_summary` / `contacts_summary` views. Deploy scripts and read paths depend on them.
- **Do not** delete `src/lbs/` — already gone. There should be zero matches for `from "@/lbs/"` or `from ".*/lbs/"` in `src/`.
- **Do not** delete `SignupPage.tsx` — route is disabled, code stays per product decision.

---

## 6. Naming (current)

| Concept | UI / nav / copy | Resource / table |
|---------|-----------------|------------------|
| Client company | **Company** | `companies` |
| Person | **Contact** | `contacts` |
| Sales pipeline item | **Deal** | `deals` |
| Won-deal delivery workspace | **Project** (only inside delivery tabs) | same `deals` row |
| Lead | **Lead** | `contacts` filtered by lead status |

Reserve "Project" for `ProjectWorkspaceTabs` and post-win delivery UI.
Top-level navigation says **Deal**.

---

## 7. Related docs

- `docs/audit/00-OVERVIEW.md` — full audit + fix-plan history
- `docs/audit/20-data-provider.md` — Option A filters, isValidRecordId guards
- `docs/audit/RESTRUCTURE-PROPOSAL.md` — original phased proposal (Phases B/C/E done, D cancelled)
- `docs/audit/AGENT-RULES.md` — agent conventions
