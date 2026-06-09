# NOMI_PRODUCT_MODE_PLAN.md

**Fase 1.5 — Product mode elimination (NO CODE)**  
**Decision:** LBS is the only product. Remove `VITE_PRODUCT_MODE`, `isLbsMode()`, and contractor/non-LBS branches entirely — do not leave dead `if (false)` paths.

**Today:** `isLbsMode() === false` ⟺ `VITE_PRODUCT_MODE=contractor` (see `src/lbs/productMode.ts`). There is no third mode.

---

## 1) Every read site: `isLbsMode()` / `VITE_PRODUCT_MODE`

### 1.1 `isLbsMode()` — **100 call sites** in **46 source files**

| File | Calls | Role |
|------|------:|------|
| `src/components/atomic-crm/root/CRM.tsx` | 10 | Routes, resources, platform vs LBS redirects |
| `src/components/atomic-crm/settings/SettingsPage.tsx` | 9 | Tab set, LBS-only sections, payments tab |
| `src/components/atomic-crm/root/defaultConfiguration.ts` | 7 | Title, stages, pipelines, categories, notes, task types |
| `src/lbs/routing.ts` | 7 | `/clients` vs `/companies`, `/leads` vs `/contacts` |
| `src/components/atomic-crm/contacts/ContactInputs.tsx` | 4 | Google Places, lead fields |
| `src/components/atomic-crm/tasks/AddTask.tsx` | 4 | Contact picker, deal link |
| `src/components/atomic-crm/providers/commons/crmPermissions.ts` | 4 | LBS resource permission overrides |
| `src/components/atomic-crm/deals/projectForm.ts` | 3 | LBS stage normalize vs contractor subcontractor_ids |
| `src/components/atomic-crm/contacts/ContactShow.tsx` | 2 | Tab set, LBS contact layout |
| `src/components/atomic-crm/contacts/ContactHeader.tsx` | 2 | SMS button, embedded actions |
| `src/components/atomic-crm/companies/CompanyInputs.tsx` | 2 | Google Places |
| `src/components/atomic-crm/deals/DealList.tsx` | 2 | Pipeline / table mode |
| `src/components/atomic-crm/layout/Header.tsx` | 2 | LBS header vs classic nav |
| `src/components/atomic-crm/layout/SidebarLayout.tsx` | 2 | `LbsSidebarNav` vs classic sidebar |
| `src/components/atomic-crm/layout/UserMenuItems.tsx` | 2 | Settings + Import menu items |
| `src/components/atomic-crm/root/ConfigurationContext.tsx` | 2 | LBS pipeline migration |
| `src/components/atomic-crm/tasks/Task.tsx` | 2 | Mention rendering |
| `src/lbs/deals/LbsDealInputs.tsx` | 2 | Conditional fields (redundant once always-LBS) |
| `src/lbs/deals/dealStageTaskTemplates.ts` | 2 | Early return when not LBS |
| `src/lbs/website-monitor/audit/WebsiteAuditBackgroundWatcher.tsx` | 2 | Guard when not LBS |
| `src/components/atomic-crm/deals/DealEdit.tsx` | 1 | Non-LBS-only transform |
| `src/components/atomic-crm/deals/DealCreate.tsx` | 1 | `lbsMode` flag |
| `src/components/atomic-crm/deals/DealListContent.tsx` | 1 | Stage-change commission automation |
| `src/components/atomic-crm/deals/DealTableView.tsx` | 1 | `useGetMany("people")` gate |
| `src/components/atomic-crm/deals/deal.ts` | 1 | LBS stage labels |
| `src/components/atomic-crm/deals/projectAssignments.ts` | 1 | Skip subcontractor sync in LBS |
| `src/components/atomic-crm/deals/stages.ts` | 1 | Stage normalization |
| `src/components/atomic-crm/dashboard/Dashboard.tsx` | 1 | `LbsDashboardTasks` vs `TasksList` |
| `src/components/atomic-crm/layout/SpotlightSearchButton.tsx` | 1 | Leads module in spotlight |
| `src/components/atomic-crm/providers/commons/canAccess.ts` | 1 | LBS module map |
| `src/components/atomic-crm/providers/commons/memberModuleAccess.ts` | 1 | LBS module tree |
| `src/components/atomic-crm/settings/workspacePermissionTree.ts` | 1 | LBS permission tree |
| `src/components/atomic-crm/tasks/TaskEditSheet.tsx` | 1 | Mention input |
| `src/components/atomic-crm/tasks/TaskFormContent.tsx` | 1 | LBS task fields |
| `src/components/atomic-crm/tasks/TaskTable.tsx` | 1 | LBS columns |
| `src/components/atomic-crm/tasks/TasksIterator.tsx` | 1 | `showDeal` default |
| `src/components/atomic-crm/tasks/TasksPageContent.tsx` | 1 | LBS layout |
| `src/lbs/LbsCustomRoutes.tsx` | 1 | **`if (!isLbsMode()) return null`** |
| `src/lbs/deals/ProjectAssignedAvatars.tsx` | 1 | `lbsMode` display gate |
| `src/lbs/deals/useLbsPipelineConfig.ts` | 1 | Pipeline config hook |
| `src/lbs/leads/ConvertLeadButton.tsx` | 1 | LBS-only convert |
| `src/lbs/messages/withLbsMessagesProvider.tsx` | 1 | Skip messages provider |
| `src/reports/ReportsPage.tsx` | 1 | LBS metrics vs payroll reports |

**Definition file (delete target):**

| File | Exports |
|------|---------|
| `src/lbs/productMode.ts` | `getProductMode()`, `isLbsMode()`, `isContractorMode()` — **`isContractorMode` has 0 consumers** |

**Import graph:** 44 files `import { isLbsMode } from "@/lbs/productMode"` (all rows above except `productMode.ts` itself).

### 1.2 `VITE_PRODUCT_MODE` — direct env reads (bypass `isLbsMode`)

| File | Reads | Notes |
|------|------:|-------|
| `src/lbs/productMode.ts` | 1 | `getProductMode()` — sole canonical reader |
| `src/components/atomic-crm/deals/DealShow.tsx` | 1 | `isContractorBuild` → lazy `ContractorDealShow` |
| `src/components/atomic-crm/deals/DealInputs.tsx` | 1 | `isContractorBuild` → lazy `DealInputsContractor` |

### 1.3 Config / docs (not runtime branches)

| Location | Value / mention |
|----------|-----------------|
| `.env.development` | `VITE_PRODUCT_MODE=lbs` |
| `NOMI_DEPRECATION_MAP.md`, `SYSTEM_AUDIT*.md`, `PROJECTS_AUDIT*.md`, `RBAC_DESIGN.md`, `WEB_FORMS_AUDIT.md` | Documentation only |
| `supabase/**` | **No** references |

### 1.4 Summary counts

| Symbol | Files | Call/read sites |
|--------|------:|----------------:|
| `isLbsMode()` | 46 | 100 |
| `VITE_PRODUCT_MODE` (code) | 3 | 3 |
| `getProductMode()` | 1 | 1 (internal) |
| `isContractorMode()` | 1 | 0 consumers |

---

## 2) If `isLbsMode() === true` always — dead code & orphan imports

### 2.1 Entire modules become deletable

| Module / folder | Why dead |
|-----------------|----------|
| `src/lbs/productMode.ts` | No branching left |
| `src/contractor/deals/ContractorDealShow.tsx` | Only loaded when `VITE_PRODUCT_MODE=contractor` |
| `src/components/atomic-crm/deals/DealInputsContractor.tsx` | Same |
| `src/people/` (UI) | Resource + routes only in `!isLbsMode()` block |
| `src/timeEntries/` | Same |
| `src/payments/` | Same |
| `src/payrollRuns/` | Same |
| `src/loans/` | Same |
| `src/platform/` (8 of 11 files) | SaaS console — see §3 |
| `demo/` | Separate demo entry; not LBS production |

### 2.2 `CRM.tsx` — dead branches & imports

**Dead `!isLbsMode()` blocks:**

- `noLayout` routes: `PlatformApp`, `PlatafformRedirect`, `/sas/*` console (~305–322)
- `CustomRoutes`: `ContactQuickViewPage`, `CompanyQuickViewPage`, 9× `PeopleQuickViewPage` routes (~340–444)
- `Resource` block: `people`, `time_entries`, `payments`, `payment_lines`, `payroll_runs`, `payroll_run_lines`, `employee_loans`, `employee_loan_deductions`, `employee_pto_adjustments` (~516–527)
- Second deal financials block: `deal_subcontractor_entries`, duplicate `deal_expenses` / `deal_change_orders` / `deal_commissions` (~582–588)
- `ImportPage` non-redirect path (~338)

**Simplifies to unconditional (LBS branch only):**

- Platform URL redirects → `/` (~293–300) — can stay as permanent legacy URL hygiene or shrink to static routes
- LBS `Resource` block (~529–576) — always on
- Payroll route redirects `/people/*` etc. (~496–512) — optional once modules gone

**Orphan imports after cleanup:**

```text
@/people
@/timeEntries, @/payments, @/payrollRuns, @/loans
@/platform/PlatafformRedirect, PlatformApp, PlatformEmpresasPage, PlatformEmpresaDetailPage
ImportPage, ContactQuickViewPage, CompanyQuickViewPage, PeopleQuickViewPage
```

### 2.3 Layout & shell — dead else-branches

| File | Dead when always-LBS |
|------|----------------------|
| `SidebarLayout.tsx` | Lines ~176–436: classic sidebar (Companies, Time & pay, People); `canViewPeople/Hours/Payments` helpers |
| `Header.tsx` | Non-LBS top nav (~22–112) |
| `UserMenuItems.tsx` | Both `{!isLbsMode() ? …}` blocks (Settings, Import) |
| `Dashboard.tsx` | `<TasksList />` branch |
| `ReportsPage.tsx` | Entire non-LBS tab UI (~120–185) + imports of 4 payroll report pages |
| `withLbsMessagesProvider.tsx` | `if (!isLbsMode())` — wrapper always applies `MessagesQuickAccessProvider` |

### 2.4 Deal / contact / settings — dead branches

| File | Dead branch |
|------|-------------|
| `DealShow.tsx` | `isContractorBuild` + `ContractorDealShow` lazy chunk (~12–30) |
| `DealInputs.tsx` | `ContractorDealInputsForm` lazy chunk (~13–31) |
| `defaultConfiguration.ts` | `contractorDealStages`, `contractorNoteStatuses` used only in `!isLbsMode()` ternaries |
| `projectForm.ts` | `if (!isLbsMode())` subcontractor_ids block (~113+) |
| `projectAssignments.ts` | Non-LBS subcontractor sync else-path |
| `DealEdit.tsx` | `if (!isLbsMode())` block |
| `ContactInputs.tsx` | Non-LBS contact fields (~173+) |
| `ContactShow.tsx` | `CONTACT_TABS` (non-LBS) |
| `SettingsPage.tsx` | `payments` tab + non-LBS `SETTINGS_TAB_IDS` / config (~60–65, 479+) |
| `AddTask.tsx` | `!isLbsMode()` contact/deal link options |
| `LbsCustomRoutes.tsx` | Early `return null` — **routes always render** |
| `dealStageTaskTemplates.ts` | `if (!isLbsMode()) return 0` guards |
| `WebsiteAuditBackgroundWatcher.tsx` | `!isLbsMode()` guards |

### 2.5 Simplification-only (keep logic, drop ternary)

These files keep **LBS behavior** but lose the `isLbsMode()` import:

- `routing.ts` — collapse to `/clients`, `/leads` paths only
- `defaultConfiguration.ts` — export LBS constants directly (drop contractor alternates)
- `crmPermissions.ts`, `canAccess.ts`, `memberModuleAccess.ts`, `workspacePermissionTree.ts`
- `ContactHeader`, `CompanyInputs`, `DealList`, `DealTableView`, `LbsDealInputs`, `ConvertLeadButton`, etc.

### 2.6 Env / build cleanup

| Item | Action |
|------|--------|
| `VITE_PRODUCT_MODE` in `.env.development` | Remove |
| `DealShow.tsx` / `DealInputs.tsx` direct env reads | Remove; always `ProjectShowPage` / `LbsDealInputs` |
| Contractor lazy chunks | Gone from production bundle (already true for `lbs` build per `PROJECTS_AUDIT.md`) |

### 2.7 Recommended execution order (when coding — not now)

1. Replace `isLbsMode()` checks with unconditional LBS paths (mechanical delete of false branches).
2. Delete `productMode.ts` + `VITE_PRODUCT_MODE`.
3. Remove dead imports and folders (§2.1).
4. Relocate §3 survivors; delete `src/platform/` remainder.
5. **`people` migration** (§4) — separate phase; do not block product-mode removal but keep `people` dataProvider until migrated.

---

## 3) `src/platform/` — relocate 3 LBS survivors, delete the rest

### Current consumers

| File | Imported by | Purpose |
|------|-------------|---------|
| `billingDefaults.ts` | `UsersSettingsSection.tsx` | `DEFAULT_SEAT_USD_PER_MONTH`, `resolveSeatPriceId()` |
| `inviteBillingGate.ts` | `UsersSettingsSection.tsx` | `inviteBillingSeatGateDisabled()` (`VITE_SKIP_USER_INVITE_BILLING`) |
| `platformConsolePaths.ts` | `authProvider.ts` | `isPlatformConsolePath()` for `/sas` auth bypass |
| `platformConsolePaths.ts` | `PlatformLayout.tsx` | `isPlatformEmpresasPathExact()` — **dies with console** |

### Proposed destinations

| Source | Move to | Rationale |
|--------|---------|-----------|
| `billingDefaults.ts` | **`src/components/atomic-crm/settings/seatBillingDefaults.ts`** | Single consumer is Settings → Users; keeps Stripe seat price next to invite UI. Alternative: `src/lbs/billing/seatBillingDefaults.ts` if you want all billing constants under LBS — slightly farther from consumer. |
| `inviteBillingGate.ts` | **`src/components/atomic-crm/settings/inviteBillingGate.ts`** | Same — paired with `UsersSettingsSection.tsx`. |
| `platformConsolePaths.ts` | **Delete (preferred)** | With SaaS console removed, `/sas` routes redirect to `/`. Remove `isPlatformConsoleAuthRoute()` from `authProvider.ts` (~124–127, ~176) instead of relocating. **No replacement file needed.** |

If you want a safety net for mistyped legacy URLs during transition, a one-liner redirect in `CRM.tsx` is enough — not a shared `platformConsolePaths` module.

### Deletable `src/platform/` files (after §3 moves / auth cleanup)

```text
PlatformApp.tsx
PlatformLayout.tsx
PlatformPage.tsx
PlatformEmpresasPage.tsx
PlatformEmpresaDetailPage.tsx
PlatformChangePasswordDialog.tsx
PlatafformRedirect.tsx
usePlatformOperator.ts
platformConsolePaths.ts   (if auth branch deleted)
```

**Net:** `src/platform/` folder can be **removed entirely** once billing helpers live under `settings/` and auth no longer references console paths.

---

## 4) `people` table risk — LBS touchpoints (migration planning only)

LBS **does not register** the `people` `<Resource>` today, but still **queries** `people` for commissions, calendar, deal list avatars, and tasks. **`deal_commissions.salesperson_id` stores `people.id`**, while `deals.salesperson_ids` stores **`organization_members.id`** — email-based bridge in `dealCommissionAutomation.ts`.

### 4.1 `src/lbs/**` — direct `people` resource / table access

| File | How it touches `people` | Migration note |
|------|----------------------|----------------|
| `src/lbs/deals/dealCommissionAutomation.ts` | `dataProvider.getList("people", { email, type: "salesperson" })` → `deal_commissions.salesperson_id` | Replace with `organization_members.id` on commissions or dedicated `salesperson_id` FK |
| `src/lbs/projects/financials/CommissionsTab.tsx` | `useGetList("people", { type: "salesperson" })` for dropdown + display names | Point at `organization_members` |
| `src/lbs/calendar/useCalendarEvents.ts` | `useGetMany("people", ids)` for `calendar_entries.person_id` labels | Repoint `person_id` → `organization_member_id` or drop if unused |
| `src/lbs/calendar/CalendarReminderDialog.tsx` | `<ReferenceInput reference="people" source="person_id" />` | Same schema/UI change |
| `src/lbs/deals/ProjectAssignedAvatars.tsx` | Renders `Person` from `peopleById`; links to `/people/:id/show` | **Broken in LBS today** (`/people/*` → `/`). Use `organization_members` + `/settings` or member profile |

**Not `people` table** (safe): `StandaloneInvoiceCreatePage` / `InlineInvoiceEditor` use **`organization_members`** for sales person on invoices.

**False positives in `src/lbs/**`:** `getPersonShowPath`, `getPersonListPath` in `routing.ts` refer to **contacts/leads** URLs, not HR `people` table. Spanish copy “Persona” in leads UI is unrelated.

### 4.2 Shared code paths active in LBS runtime

| File | How it touches `people` |
|------|-------------------------|
| `src/components/atomic-crm/deals/DealTableView.tsx` | `useGetMany("people")` when `lbsMode && peopleIds` from `deal.salesperson_ids` |
| `src/components/atomic-crm/tasks/useCurrentMemberPerson.ts` | Maps current `organization_members` row → `people` by email |
| `src/components/atomic-crm/tasks/TaskAssignedAvatars.tsx` | `useGetMany("people")` for task assignees |
| `src/components/atomic-crm/tasks/TaskDescriptionMentionInput.tsx` | `useGetList("people")` for @mentions |
| `src/components/atomic-crm/tasks/enrichTasksWithLegacyMentions.ts` | `getList("people")` for legacy mention IDs |
| `src/components/atomic-crm/tasks/taskAssignments.ts` | `getList("people")` when resolving assignments |

### 4.3 Data layer (keep until migration)

| File | Role |
|------|------|
| `src/components/atomic-crm/providers/supabase/dataProvider.ts` | `people` CRUD handlers (~3147+) |
| `src/components/atomic-crm/providers/fakerest/dataProvider.ts` | Demo `people` seed + payroll side effects |
| `src/components/atomic-crm/types.ts` | `Person` type + resource name in union |

### 4.4 Suggested migration track (later — not Fase 1.5 scope)

1. **Commissions:** `deal_commissions.salesperson_id` → `organization_member_id` (migration + update `CommissionsTab`, `dealCommissionAutomation`).
2. **Calendar:** `calendar_entries.person_id` → `organization_member_id` (or remove field if deprecated).
3. **Tasks:** Mentions/assignments use `organization_members` only (`useCurrentMemberPerson` becomes trivial).
4. **Deal list avatars:** `DealTableView` / `ProjectAssignedAvatars` read `organization_members` via `deal.salesperson_ids`.
5. **Drop** `people` table + dataProvider handlers once no FKs remain.

---

## Decision checklist (for approval before implementation)

- [ ] Delete `productMode.ts` and all `isLbsMode()` / `VITE_PRODUCT_MODE` branches (no stub `() => true`).
- [ ] Delete contractor build (`DealShow` / `DealInputs` env gates + `src/contractor/`).
- [ ] Delete non-LBS payroll folders and `CRM.tsx` resource blocks.
- [ ] Delete `src/platform/` console; move seat billing helpers to `settings/`; remove auth console bypass.
- [ ] Plan `people` → `organization_members` migration separately (§4).

---

*Generated: Fase 1.5 — NO CODE changes.*
