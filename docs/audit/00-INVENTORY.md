# Nomi CRM — Audit Inventory (STEP 0)

**Date:** 2026-06-02  
**Stack:** React 19 + Vite + Supabase + Vercel  
**Scope:** READ-ONLY discovery. No code moves, no fixes, no migrations.  
**Status:** Awaiting approval before STEP 1 per-module audits.

---

## How to read this document

| Column / term | Meaning |
|---------------|---------|
| **Sidebar** | Linked from `LBS_NAV_*` in `src/lbs/navigation.ts` via `LbsSidebarNav` or top `Header` |
| **User menu** | Profile / Settings links in `UserMenuItems.tsx` |
| **ORPHAN** | Route registered in the router but **not** in sidebar, user menu, or documented public entry |
| **Deep link** | Intentionally not in sidebar; reached from in-app actions (show/create/edit) |
| **RA resource** | React-admin auto-route from `<Resource>` in `CRM.tsx` |

**Primary route config files:**

| File | Role |
|------|------|
| `src/App.tsx` | Entry → `<CRM />` |
| `src/components/atomic-crm/root/CRM.tsx` | Admin shell, resources, auth/public routes, mobile split |
| `src/lbs/LbsCustomRoutes.tsx` | LBS custom routes (authenticated + public renderers) |
| `src/lbs/navigation.ts` | Sidebar / top-nav item definitions |
| `src/lbs/routing.ts` | Canonical path helpers |
| `src/lbs/LbsSidebarNav.tsx` | Sidebar rendering + capability gating |

---

## 1. Sidebar navigation (source of truth)

From `src/lbs/navigation.ts`:

### Standalone

| Label | Path | Capability |
|-------|------|------------|
| Dashboard | `/` | `crm.pipeline.view` |
| Leads | `/leads` | `crm.contacts.view` |

### Clients (collapsible)

| Label | Path | Capability |
|-------|------|------------|
| Companies | `/companies` | `crm.companies.view` |
| Contacts | `/contacts` | `crm.contacts.view` |

### Pipeline

| Label | Path |
|-------|------|
| Deals | `/deals` |

### Close & bill

| Label | Path |
|-------|------|
| Proposals | `/proposals` |
| Contracts | `/contracts` |
| Billing | `/billing` |

### Daily work

| Label | Path |
|-------|------|
| Tasks | `/tasks` |
| Calendar | `/calendar` |
| Meetings | `/meetings` |
| Messages | `/messages` |
| Tickets | `/tickets` |

### Tools

| Label | Path | Notes |
|-------|------|-------|
| Web Monitor | `/web-monitor` | Hidden when `websiteMonitorEnabled === false` |

### User menu (not sidebar)

| Label | Path | File |
|-------|------|------|
| General (Settings) | `/settings` | `SettingsPage.tsx` |
| Profile | `/profile` | `ProfilePage.tsx` |

### Mobile bottom nav (`MobileNavigation.tsx`)

| Tab | Path |
|-----|------|
| Home | `/` |
| Contacts | `/contacts` |
| Tasks | `/tasks` |

**Not in mobile nav:** Deals, Leads list, Proposals, Billing, Calendar, Messages, Tickets, Web Monitor.

---

## 2. Complete route inventory

### 2.1 Auth & account (no CRM layout)

| Path | Component | File | Nav |
|------|-----------|------|-----|
| `/login` | `StartPage` → `LoginPage` | `src/components/atomic-crm/login/` | Public |
| `/sign-up/*` | Redirect → `/login` | `CRM.tsx` | **Signup UI exists but route redirects** |
| `/set-password` | `SetPasswordPage` | `src/components/supabase/set-password-page.tsx` | Public |
| `/forgot-password` | `ForgotPasswordPage` | `src/components/supabase/forgot-password-page.tsx` | Public |
| `/oauth/consent` | `OAuthConsentPage` | `src/components/supabase/oauth-consent-page.tsx` | Public |

**Dead auth-related code (no active route):**

- `SignupPage` (`/sign-up`) — component exists, route redirects to login
- `ConfirmationRequired` (`/sign-up/confirm`) — not registered

---

### 2.2 Public / client-facing (no CRM layout)

| Path | Component | File |
|------|-----------|------|
| `/forms/:slug` | `FormPublicEntry` | `src/lbs/forms-v2/public/FormPublicEntry.tsx` |
| `/f/:shortCode` | `ShortUrlRedirect` | `src/lbs/forms-v2/public/ShortUrlRedirect.tsx` |
| `/proposal/:token` | `PublicProposalPage` | `src/lbs/proposals/public/PublicProposalPage.tsx` |
| `/proposal/:token/accept` | `PublicProposalAcceptPage` (e-sign + deposit) | `src/lbs/proposals/public/PublicProposalAcceptPage.tsx` |
| `/pr/:shortCode` | `ProposalShortUrlRedirect` | `src/lbs/proposals/public/ProposalShortUrlRedirect.tsx` |
| `/invoice/:token` | `PublicInvoicePage` | `src/lbs/billing/public/PublicInvoicePage.tsx` |
| `/iv/:shortCode` | `InvoiceShortUrlRedirect` | `src/lbs/billing/public/InvoiceShortUrlRedirect.tsx` |
| `/portal` | `ClientPortalPage` | `src/lbs/portal/ClientPortalPage.tsx` |
| `/portal/invoice/:token` | `ClientPortalInvoicePage` | `src/lbs/portal/ClientPortalInvoicePage.tsx` |
| `/p/:shortCode` | `PortalShortUrlRedirect` | `src/lbs/portal/PortalShortUrlRedirect.tsx` |
| `/proposals/:id/client-preview` | `ProposalClientPreviewRoute` | `src/lbs/proposals/document/ProposalClientPreviewRoute.tsx` |

Staff-authenticated, no CRM chrome: client-preview route.

---

### 2.3 Dashboard

| Path | Component | File | Sidebar |
|------|-----------|------|---------|
| `/` | `Dashboard` / `MobileDashboard` | `src/components/atomic-crm/dashboard/` | ✅ |

---

### 2.4 Leads

| Path | Component | File | Sidebar |
|------|-----------|------|---------|
| `/leads` | `LeadsListPage` | `src/lbs/leads/LeadsListPage.tsx` | ✅ |
| `/leads/create` | `LeadCreatePage` | `src/lbs/leads/LeadCreatePage.tsx` | Deep link |
| `/leads/:id/show` | `LeadShowPage` | `src/lbs/leads/LeadShowPage.tsx` | Deep link |

**Related feature (not a cron):** **Anti-Olvido** — lead follow-up radar driven by `contacts.lead_stage`, `snooze_until`, and deal sync triggers (`PLAN_FASE_1.md`, `dataProvider.convertLeadToClient`). **Not a Vercel cron.**

---

### 2.5 Companies (Clients)

| Path | Component | File | Sidebar |
|------|-----------|------|---------|
| `/companies` | `CompaniesListPage` | `src/lbs/clients/CompaniesListPage.tsx` | ✅ |
| `/companies/:id` | `ClientShowPage` | `src/lbs/clients/ClientShowPage.tsx` | Deep link |
| `/companies/find-duplicates` | `FindDuplicatesPage` | `src/lbs/clients/FindDuplicatesPage.tsx` | Deep link |
| `/companies/create` | `LegacyCompanyCreateRedirect` | `src/lbs/CompanyRouteRedirects.tsx` | Redirect |
| `/companies/:id/edit` | `LegacyCompanyEditRedirect` | Redirect |
| `/companies/:id/show`, `.../:tab` | `LegacyCompanyShowRedirect` | Redirect |
| `/clients`, `/clients/*` | Legacy → companies | `src/lbs/clients/ClientRouteRedirects.tsx` | Redirect |

---

### 2.6 Contacts

| Path | Component | File | Sidebar |
|------|-----------|------|---------|
| `/contacts` | `ContactsListPage` | `src/lbs/clients/ContactsListPage.tsx` | ✅ |
| `/contacts/create` | Redirect → `?create=contact` | `LbsCustomRoutes.tsx` | Deep link |
| `/contacts/:id/show` | `LbsContactShowPage` | `src/lbs/contacts/ContactShowPage.tsx` | Deep link |
| `/contacts/:id` | RA `ContactEdit` | `src/components/atomic-crm/contacts/ContactEdit.tsx` | Legacy RA |
| `/contacts/:id/notes/:noteId` | `NoteShowPage` | Mobile-only nested route | Mobile |

**Unregistered:** `ContactQuickViewPage` — no route.

---

### 2.7 Deals / Projects (pipeline)

| Path | Component | File | Sidebar |
|------|-----------|------|---------|
| `/deals` | `DealList` (kanban/table) | `src/components/atomic-crm/deals/DealList.tsx` | ✅ |
| `/deals/create` | `ProjectCreateFlow` | `src/lbs/deals/ProjectCreateFlow.tsx` | Deep link (modal flow) |
| `/deals/:id` | `DealEdit` | `DealEdit.tsx` | Deep link |
| `/deals/:id/show` | `DealShow` | `DealShow.tsx` | Deep link |
| `/projects` | Redirect → `/deals` | `CRM.tsx` | Redirect |

---

### 2.8 Proposals

| Path | Component | File | Sidebar |
|------|-----------|------|---------|
| `/proposals` | `ProposalsList` | `src/lbs/proposals/ProposalsList.tsx` | ✅ |
| `/proposals/create` | `ProposalCreate` | `src/lbs/proposals/ProposalCreate.tsx` | Deep link |
| `/proposals/:id/show` | `ProposalViewPage` | `src/lbs/proposals/ProposalViewPage.tsx` | Deep link |
| `/proposals/:id/edit` | `ProposalEdit` | `src/lbs/proposals/ProposalEdit.tsx` | Deep link |
| `/proposals/:id/preview` | `ProposalPreviewPage` | `src/lbs/proposals/document/ProposalPreviewPage.tsx` | Deep link |
| `/proposals-placeholder` | `ProposalsPlaceholderPage` | `src/lbs/placeholders/` | **ORPHAN** |

---

### 2.9 Contracts

| Path | Component | File | Sidebar |
|------|-----------|------|---------|
| `/contracts` | `ContractsList` | `src/lbs/contracts/ContractsList.tsx` | ✅ |
| `/contracts/:id/show` | `ContractShow` | `src/lbs/contracts/ContractShow.tsx` | Deep link |
| `/contracts-placeholder` | `ContractsPlaceholderPage` | `src/lbs/placeholders/` | **ORPHAN** |

E-signature for contracts flows through `/proposal/:token/accept`, not a separate contract public route.

---

### 2.10 Billing

| Path | Component | File | Sidebar |
|------|-----------|------|---------|
| `/billing` | `ClientBillingPage` | `src/lbs/billing/ClientBillingPage.tsx` | ✅ |
| `/billing/invoices/new` | `StandaloneInvoiceCreatePage` | Deep link |
| `/billing/invoices/:id/show` | `InvoiceWorkspaceRedirect` → `?invoice=` | Redirect |
| `/billing/invoices/:id/edit` | `InvoiceWorkspaceRedirect` | Redirect |

**Unregistered:** `StandaloneInvoiceShowPage` — no router entry.

---

### 2.11 Forms v2 (staff)

| Path | Component | File | Sidebar |
|------|-----------|------|---------|
| `/forms-v2` | `FormsListPage` | `src/lbs/forms-v2/FormsListPage.tsx` | **ORPHAN** (Settings tab embed) |
| `/forms-v2/new` | `FormBuilderPage` | Deep link |
| `/forms-v2/:id/edit` | `FormBuilderPage` | Deep link |
| `/forms-v2/submissions` | `SubmissionsListPage` | Deep link |
| `/forms-v2/submissions/:id` | `SubmissionDetailPage` | Deep link |
| `/forms-v2/:id/analytics` | `FormAnalyticsPage` | Deep link |
| `/web-forms`, `/web-forms/*` | Redirect → `/forms-v2` | Redirect |

Legacy `src/lbs/web-forms/*` is **not mounted** as a resource.

---

### 2.12 Tasks, Calendar, Meetings, Messages

| Path | Component | File | Sidebar |
|------|-----------|------|---------|
| `/tasks` | `TaskList` / `MobileTasksList` | `src/components/atomic-crm/tasks/` | ✅ |
| `/calendar` | `CalendarPage` | `src/lbs/calendar/CalendarPage.tsx` | ✅ |
| `/meetings` | `MeetingsPage` | `src/lbs/meetings/MeetingsPage.tsx` | ✅ |
| `/messages` | `MessagesPage` (lazy) | `src/lbs/messages/MessagesPage.tsx` | ✅ |

---

### 2.13 Tickets

| Path | Component | File | Sidebar |
|------|-----------|------|---------|
| `/tickets` | `TicketsList` | `src/lbs/tickets/TicketsList.tsx` | ✅ |
| `/tickets/create` | `TicketCreate` | Deep link |
| `/tickets/:id/show` | `TicketShow` | Deep link |
| `/tickets-placeholder` | `TicketsPlaceholderPage` | **ORPHAN** |

---

### 2.14 Web Monitor

| Path | Component | File | Sidebar |
|------|-----------|------|---------|
| `/web-monitor` | `WebsiteMonitorListPage` | `src/lbs/website-monitor/` | ✅ (conditional) |
| `/web-monitor/:id/show` | `WebsiteMonitorShowPage` | Deep link |
| `/web-monitor/:siteId/audit/:auditId` | `WebsiteAuditReportPage` | Deep link |

---

### 2.15 Reports

| Path | Component | File | Sidebar |
|------|-----------|------|---------|
| `/reports` | `ReportsPage` | `src/reports/ReportsPage.tsx` | **ORPHAN** |
| `/reports/web-agency-metrics` | `ReportsPage` (tab) | Same | **ORPHAN** |

---

### 2.16 Settings & profile

| Path | Component | File | Nav |
|------|-----------|------|-----|
| `/settings` | `SettingsPage` | `src/components/atomic-crm/settings/SettingsPage.tsx` | User menu |
| `/profile` | `ProfilePage` | `ProfilePage.tsx` | User menu |

**Settings tabs** (`/settings?tab=`):

| `tab` | Section |
|-------|---------|
| `general` | Company settings (default) |
| `users` | Users / invites / billing seats |
| `forms` | Forms (embeds `FormsListPage`) |
| `messaging` | Communications (Twilio, email) |
| `web-monitor` | Web Monitor + GSC OAuth return |
| `commercial` | Proposals & contracts |
| `projects` | Pipeline stages |
| `notes` | Lead statuses |
| `tasks` | Task types |
| `data` | Data import (+ Zoho OAuth return) |

**Legacy aliases:** `tab=plans|roles` → `users`; `section=users|general` → `tab`.

| Path | Component | Purpose |
|------|-----------|---------|
| `/organization_members` | Redirect → settings users | RA stub |
| `/organization_members/create` | Redirect | RA stub |
| `/organization_members/:id` | Redirect | Linked from avatars |

---

### 2.17 Legacy / stub redirects (`CRM.tsx`)

| Path | Target |
|------|--------|
| `/import` | `/` (`ImportPage` exists but unreachable) |
| `/platafform`, `/platform`, `/sas`, `/time_entries/*`, `/payroll_runs/*`, `/payments/*`, `/employee_loans/*`, `/people/*` | `/` |

---

### 2.18 React-admin data-only resources (no list UI)

Registered in `CRM.tsx` without navigable pages — used as nested/API resources only:

`forms`, `form_submissions`, `form_instances`, `form_submissions_v2`, `form_submission_events`, `public_form_tokens`, `form_templates`, `ticket_messages`, `conversations`, `conversation_participants`, `conversation_messages`, `message_templates`, `voice_calls`, `deal_resources`, `deal_access_entries`, `deal_secrets`, `deal_expenses`, `deal_change_orders`, `proposal_line_items`, `proposal_payment_schedules`, `proposal_payment_installments`, `client_invoices`, `client_invoice_line_items`, `proposal_templates`, `service_packages`, `service_addons`, `organization_contract_terms`, `deal_client_payments`, `organization_pipeline_stages`, `deal_launch_checklist_items`, `launch_checklist_templates`, `deal_milestones`, `maintenance_retainers`, `maintenance_hours_log`, `client_portal_accounts`, `client_portal_deal_access`, `project_deliveries`, `project_delivery_notifications`, `deal_approvals`, `report_web_agency_metrics`, `deal_activity_unified`, `contact_notes`, `deal_notes`, `tags`, `monitored_websites`, `calendar_events`, …

*(Full list to be enumerated in STEP 1 database audit.)*

---

## 3. ORPHANED routes summary

Routes **defined in router** but **not in sidebar or user menu** (excluding intentional public/auth/deep-link):

| Route(s) | Notes |
|----------|-------|
| `/reports`, `/reports/web-agency-metrics` | No in-app nav link found |
| `/forms-v2` and all `/forms-v2/*` | Entry via Settings → Forms tab only |
| `/proposals-placeholder`, `/contracts-placeholder`, `/tickets-placeholder` | Rollout stubs |
| `/import` | Redirects to `/`; page component orphaned |
| `/sign-up/*` | Redirects to login; signup components orphaned |

**Dead components (exported but no route):** `SignupPage`, `ConfirmationRequired`, `ContactQuickViewPage`, `StandaloneInvoiceShowPage`, `ImportPage`.

---

## 4. Backend & infrastructure inventory

### 4.1 Supabase Edge Functions (71)

All under `supabase/functions/<name>/index.ts`. Shared code: `supabase/functions/_shared/`.

| Group | Functions |
|-------|-----------|
| **Auth & platform** | `users`, `update_password`, `platform-directory`, `merge_contacts` |
| **Org billing (Stripe seats)** | `stripe-billing`, `stripe-webhook` |
| **Client billing** | `create_client_invoice`, `update_client_invoice`, `issue_client_invoice`, `manage_client_invoice`, `schedule_client_invoice`, `send_client_invoice`, `share_client_invoice`, `get_public_invoice`, `pay_client_invoice`, `prepare_client_invoice_payment`, `charge_client_invoice_on_file`, `send_client_invoice_payment_link`, `resend_client_invoice_payment_receipt`, `process_scheduled_payments`, `process_scheduled_client_invoices`, `process_invoice_payment_reminders`, `process_invoice_auto_charges`, `process_missed_invoice_payment_receipts`, `stripe-client-webhook` |
| **Proposals** | `send_proposal`, `get_public_proposal`, `accept_proposal`, `sign_proposal_contract`, `pay_proposal_deposit` |
| **Messaging** | `postmark`, `twilio_inbound_sms`, `send_client_sms`, `messaging_settings`, `email_settings`, `send_meeting_link`, `notify_follow_up`, `send_calendar_reminders`, `whatsapp_inbound`, `send_whatsapp`, `voice_token`, `voice_status_webhook` |
| **Forms v2** | `generate_form_token`, `get_form_by_token`, `submit_form_v2`, `forms_embed_js`, `upload_form_file`, `record_form_event`, `resolve_short_code`, `submit_project_resources` |
| **Client portal & projects** | `client_portal`, `client_portal_credentials`, `resolve_portal_short_code`, `deliver_project`, `get_public_deal_brief`, `deal_secret_value`, `access_entry_password`, `get_github_repo_status` |
| **Web monitor & audit** | `website_monitor_run`, `website_monitor_check`, `website_monitor_sync`, `website_monitor_create`, `website_monitor_run_org`, `website_audit_enqueue`, `website_audit_callback`, `website_audit_schedule`, `website_audit_summarize`, `website_audit_send`, `google_gsc`, `google_places` |
| **Import** | `zoho_oneshot_import` |

**Shell / stub functions (503 or log-only):** `send_whatsapp`, `voice_token`, `voice_status_webhook`, `whatsapp_inbound`.

**Deploy helper:** `scripts/deploy-edge-bundles.sh`

---

### 4.2 Vercel crons (`vercel.json`)

| Path | Schedule (UTC) | Invokes |
|------|----------------|---------|
| `/api/cron/process-scheduled-payments` | Daily 14:00 | Edge `process_scheduled_payments` |
| `/api/cron/process-scheduled-client-invoices` | Daily 15:00 | Edge `process_scheduled_client_invoices` |

Handlers: `api/cron/process-scheduled-payments.ts`, `api/cron/process-scheduled-client-invoices.ts`  
Auth: `Authorization: Bearer ${CRON_SECRET}` → forwards `x-cron-secret` to Supabase.

**Note:** Comment in handler mentions "every 2h" but `vercel.json` is **daily**.

**Anti-Olvido is NOT a Vercel cron** — it is in-app lead attention logic.

---

### 4.3 Supabase pg_cron

Requires Vault secrets `website_monitor_project_url` + `website_monitor_cron_secret`.

**Live hosted DB** (queried 2026-06-02 via `npx supabase db query --linked` on project `qjglkywmqwqdoaboakao`): **6 jobs** in `cron.job`:

| Job | Schedule | Target | Edge function |
|-----|----------|--------|---------------|
| `website_monitor_run_every_5m` | `*/5 * * * *` | `invoke_website_monitor_run()` | **`website_monitor_run`** |
| `website_audit_push_retry` | `*/5 * * * *` | `invoke_website_audit_schedule('retry')` | **`website_audit_schedule`** |
| `website_audit_schedule_daily` | `0 7 * * *` | `invoke_website_audit_schedule('due')` | **`website_audit_schedule`** |
| `fail_stale_website_audits` | `*/15 * * * *` | `fail_stale_website_audits(900)` | SQL only |
| `client_invoice_payment_reminders_daily` | `0 14 * * *` | `invoke_client_invoice_billing_cron('process_invoice_payment_reminders')` | **`process_invoice_payment_reminders`** |
| `client_invoice_auto_charges_daily` | `0 15 * * *` | `invoke_client_invoice_billing_cron('process_invoice_auto_charges')` | **`process_invoice_auto_charges`** |

**In repo migrations but NOT in live DB:** `fail_stale_website_audits_5m` (`*/5 * * * *`).

**Edge functions with no pg_cron, no Vercel cron, no client invoke (orphaned schedulers):**

- `send_calendar_reminders` (function comment suggests every 5 min)
- `process_missed_invoice_payment_receipts`

**DORMANT — pending Meta appeal (not deletion candidates):** `send_whatsapp`, `whatsapp_inbound`, `voice_token`, `voice_status_webhook`.

See `00-OVERVIEW.md` for full orphan/DORMANT table.

---

### 4.4 External workers

| Worker | Path | Deployment |
|--------|------|------------|
| **Web audit worker** | `workers/web-audit/` | **Google Cloud Run** (primary, `CLOUD_RUN.md`) or **Fly.io** legacy (`fly.toml`, app `nomi-web-audit`) |

Env (Supabase secrets): `WEB_AUDIT_WORKER_URL`, `WEB_AUDIT_WORKER_SECRET`  
Callback: Edge `website_audit_callback`

No other workers in repo.

---

### 4.5 Inbound webhooks (external → Edge)

| Provider | Function |
|----------|----------|
| Postmark (inbound email) | `postmark` |
| Stripe (org billing) | `stripe-webhook` |
| Stripe (client payments) | `stripe-client-webhook` |
| Twilio SMS | `twilio_inbound_sms` |
| Web audit worker | `website_audit_callback` |
| Meta WhatsApp | `whatsapp_inbound` (shell) |
| Twilio Voice | `voice_status_webhook` (shell) |

---

## 5. Frontend source layout (high level)

```
src/
├── App.tsx
├── components/
│   ├── admin/          # shadcn-admin-kit (mutable)
│   ├── atomic-crm/     # Core CRM (~15k LOC): contacts, deals, tasks, settings…
│   ├── supabase/       # Auth pages
│   └── ui/             # Shadcn UI (mutable)
├── lbs/                # LBS product layer (clients, proposals, billing, forms-v2…)
├── lib/                # Shared utilities
├── hooks/
└── reports/            # Reports module (orphaned nav)
supabase/
├── functions/          # 71 edge functions
└── migrations/         # Schema + RLS + pg_cron
workers/
└── web-audit/          # Lighthouse/axe worker
api/cron/               # Vercel cron handlers (2 files)
```

**Known structural issues (for STEP 3 restructure proposal):**

- Split between `atomic-crm/` (generic CRM) and `lbs/` (agency product) with overlapping domains (deals live in both)
- Legacy paths: `/clients/*`, `/web-forms`, `/people/*`, contractor fields in deal model
- Mixed naming: Companies vs Clients in UI; Projects vs Deals in copy
- Large god-files: `dataProvider.ts`, `CRM.tsx`, `SettingsPage.tsx`

---

## 6. Pre-identified issues (for STEP 1 assignment)

*Not fixed in this audit pass; documented for module assignment.*

| Issue | Severity | Module | File(s) |
|-------|----------|--------|---------|
| `Badge is not defined` crash on Contracts list | CRITICAL | Contracts | `src/lbs/contracts/ContractsList.tsx` |
| `Badge is not defined` crash on Tickets list | CRITICAL | Tickets | `src/lbs/tickets/TicketsList.tsx` — **fixed** (audit close-out) |
| `MoneyText is not defined` crash on Proposals list | CRITICAL | Proposals | `src/lbs/proposals/ProposalsList.tsx` |
| `Button is not defined` crash on Convert Lead | CRITICAL | Leads | `src/lbs/leads/ConvertLeadButton.tsx` |
| Deals open filter `stage@nin` → PostgREST 400 | HIGH | Deals / Clients sidebar | `src/lbs/deals/openDealFilters.ts` |
| `getOne` on proposals/contacts with empty id → 406 | HIGH | Proposals / dataProvider | Multiple hooks + `dataProvider.ts` |
| `person_id` revert leftovers | HIGH | Cross-cutting | TBD in STEP 1 grep |
| RLS blocking save/create/login | HIGH | Auth / DB | TBD in STEP 1 |
| Orphaned routes / dead components | MEDIUM | Routing | See §3 |
| Mobile missing Deals/Leads nav | MEDIUM | Mobile | `MobileNavigation.tsx`, `CRM.tsx` |
| WhatsApp/Voice shells return 503 | LOW | Messaging | Edge functions |

---

## 7. Proposed per-module audit files (STEP 1)

One Markdown file per module. Numbering leaves gaps for infrastructure docs.

### Frontend product modules

| File | Module | Primary paths / areas |
|------|--------|---------------------|
| `01-auth-public-routes.md` | Auth + public client routes | Login, signup stubs, portal, public proposal/invoice/form |
| `02-dashboard.md` | Dashboard | `/`, widgets, activity |
| `03-leads.md` | Leads + Anti-Olvido | `/leads/*`, convert lead, kanban, follow-up |
| `04-companies-clients.md` | Companies | `/companies/*`, client show, duplicates |
| `05-contacts.md` | Contacts | `/contacts/*`, contact show, merge |
| `06-deals-pipeline.md` | Deals / Projects | `/deals/*`, kanban, project create flow, stage automations |
| `07-proposals.md` | Proposals | `/proposals/*`, builder, public accept, PDF |
| `08-contracts.md` | Contracts | `/contracts/*`, linked to proposals |
| `09-billing.md` | Billing & invoices | `/billing/*`, Stripe client payments, standalone invoices |
| `10-tasks.md` | Tasks | `/tasks`, assignments, mentions |
| `11-calendar-meetings.md` | Calendar + Meetings | `/calendar`, `/meetings`, reminders |
| `12-messages.md` | Messages / SMS | `/messages`, Twilio, conversations |
| `13-tickets.md` | Tickets | `/tickets/*` |
| `14-web-monitor.md` | Web Monitor + audits | `/web-monitor/*`, GSC, worker callback |
| `15-forms-v2.md` | Forms v2 | `/forms-v2/*`, public forms, submissions |
| `16-reports.md` | Reports | `/reports/*` (orphaned) |
| `17-settings-profile.md` | Settings + Profile | `/settings`, `/profile`, all tabs |
| `18-mobile-experience.md` | Mobile admin | `MobileAdmin`, bottom nav, reduced routes |

### Data layer & backend

| File | Module | Scope |
|------|--------|-------|
| `20-data-provider.md` | Supabase + FakeRest dataProvider | All custom methods, filter syntax, getOne/create patterns |
| `21-database-schema-rls.md` | PostgreSQL schema | Tables, FKs, RLS, triggers, orphan SQL report |
| `22-auth-session-invites.md` | Auth + org members | JWT, invites, roles, RLS vs app permissions |
| `23-edge-functions-billing.md` | Edge: billing + Stripe | 20 functions |
| `24-edge-functions-proposals-portal.md` | Edge: proposals, portal, projects | accept, portal, deliver, secrets |
| `25-edge-functions-messaging.md` | Edge: email, SMS, voice, WhatsApp | postmark, twilio, shells |
| `26-edge-functions-forms.md` | Edge: forms v2 | tokens, submit, embed |
| `27-edge-functions-web-monitor.md` | Edge: monitor + audit + GSC | 12 functions + worker |
| `28-edge-functions-platform.md` | Edge: users, import, merge | users, zoho, merge_contacts |
| `29-scheduled-jobs.md` | Crons & schedules | Vercel crons, pg_cron, undocumented crons |
| `30-external-workers.md` | Web audit worker | Cloud Run / Fly.io, env, callback |

### Cross-cutting & wrap-up (STEP 2–4)

| File | Purpose |
|------|---------|
| `00-OVERVIEW.md` | Master summary, diagrams, prioritized fix plan (STEP 2) |
| `RESTRUCTURE-PROPOSAL.md` | Folder restructure proposal (STEP 3) |
| `AGENT-RULES.md` | Agent conventions (STEP 4) |

**Total STEP 1 module files:** 28  
**Plus:** overview, restructure, agent rules, this inventory = **32 audit documents**

---

## 8. STEP 1 execution order (recommended)

After approval, audit in dependency order:

1. `20-data-provider` + `21-database-schema-rls` + `22-auth` (foundation)
2. `01-auth-public-routes`
3. Clients cluster: `03-leads` → `04-companies` → `05-contacts` → `06-deals`
4. Revenue cluster: `07-proposals` → `08-contracts` → `09-billing`
5. Daily work: `10`–`13`
6. Tools: `14-web-monitor`, `15-forms-v2`, `16-reports`
7. `17-settings`, `18-mobile`
8. Edge functions `23`–`28`, `29`, `30`
9. Write `00-OVERVIEW.md` last

---

## 9. Approval gate

**Audit complete** (2026-06-02). Deliverables:

| Deliverable | File |
|-------------|------|
| Inventory | `00-INVENTORY.md` |
| Overview + diagrams + fix plan | `00-OVERVIEW.md` |
| Module audits batch 1 | `02-dashboard` … `09-billing`, `19-orphaned-routes` |
| Module audits batch 2 | `10-tasks` … `22-auth-session-invites`, `20-data-provider` |
| Restructure proposal | `RESTRUCTURE-PROPOSAL.md` |
| Agent rules | `AGENT-RULES.md` |

**Fix phase:** Execute P0–P5 in `00-OVERVIEW.md` with explicit approval. Orphan deletions per `19-orphaned-routes.md` — **not during audit**.

**Do not proceed to bulk restructure until P0–P3 stabilizes runtime.**
