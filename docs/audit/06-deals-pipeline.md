# Deals (Pipeline / Projects)

## 1. Purpose

Sales and delivery pipeline at `/deals` (kanban + table). Each row is a **deal** record; staff UI says **Projects**. Default stages are the **9-stage** web pipeline in `lbsProjectConstants.ts` (also seeded in `organization_pipeline_stages`). Create flow: `/deals/create` (manual project vs web form). Detail: `/deals/:id/show` (`ProjectShowPage` + workspace tabs). Client context navigates to the same create route (no separate create dialog).

See also: [`DEALS-PROJECTS-DECISIONS.md`](DEALS-PROJECTS-DECISIONS.md), [`DEALS-PROJECTS-STAGES-MATRIX.md`](DEALS-PROJECTS-STAGES-MATRIX.md).

## 2. Files & components

| Area | Paths |
|------|-------|
| List/Board | `src/components/atomic-crm/deals/DealList.tsx`, `LbsDealBoardContent.tsx` |
| Show | `src/modules/deals/projects/ProjectShowPage.tsx`, `ProjectWorkspaceTabs.tsx`, `LbsDealHeaderOverview.tsx` |
| Create | `src/modules/deals/ProjectCreateFlow.tsx`, `projects/AgencyProjectCreateForm.tsx` |
| Shared insert | `src/modules/deals/createDeal.ts`; lead convert uses `buildDealInsertRecord` |
| Stage | `dealStageMutations.ts`, `useLbsPipelineConfig.ts`, `useStageDeals.ts` |
| Forms | `LbsDealInputs.tsx`, `projectForm.ts`, `lbsAgencyProjectModel.ts` |
| Filters | `src/modules/deals/openDealFilters.ts` |
| Realtime | `useDealsRealtime.ts`, `useDealResourcesRealtime.ts` |

## 3. Database

| Table | Role |
|-------|------|
| `deals` | Core: `name`, `stage`, `pipeline_id`, `lifecycle_phase`, `company_id`, `contact_id`, `contact_ids`, amounts, `website_brief`, `org_id`, `index` |
| `organization_pipeline_stages` | Per-org kanban columns |
| `deal_notes`, `deal_resources`, `deal_expenses`, `deal_change_orders`, `deal_client_payments` | Child resources |
| `deal_launch_checklist_items`, `deal_milestones` | Delivery |
| `tasks` | `deal_id` |
| `proposals` | `deal_id`, `accepted_proposal_id` on deal |

**Triggers:** `trg_sync_deal_to_lead_stage` (deal stage → contact lead_stage).

**RLS:** `deals.org_id`; policies in `20260630304000_scope_deals_update_delete_rls.sql`, `20260630300000_fix_can_view_deal_lbs.sql`.

## 4. External services

| Service | Usage |
|---------|--------|
| GitHub | Repo status on deal — `get_github_repo_status` |
| Stripe | Via proposals/billing on linked deals |
| Web audit worker | Indirect via company web monitor |

## 5. Connections to other modules

| Direction | Module |
|-----------|--------|
| ← Leads | Convert → closed-won deal |
| ← Proposals | Accept → activates deal |
| ↔ Companies/Contacts | FKs on deal |
| → Tasks, Calendar | `deal_id` |
| → Billing | Installments, invoices |
| → Web forms | Website intake → brief |

## 6. Edge functions used by this module

| Function | Caller | Purpose |
|----------|--------|---------|
| `get_public_deal_brief` | `dataProvider.getPublicDealBrief` | Public/client brief fetch |
| `get_github_repo_status` | `dataProvider.getGithubRepoStatus` | Repo badge on deal |
| `submit_project_resources` | `dataProvider.submitProjectResources` | Client resource upload |
| `deliver_project` | `dataProvider.deliverProject` | Mark delivered + portal notify |
| `generate_form_token` | Project web form send flow | Intake link |

**Direct Supabase (no edge):** `createDeal`, standard deal CRUD, `convertLeadToClient` deal insert.

## 7. Status: PARTIAL

Kanban and create flows work. Open-deals sidebar filter was **BROKEN** (400) until `stage@in` fix. New Deal modal added in working tree — needs QA on pipeline appearance.

## 8. Issues found

| Severity | Location | User impact | Root cause |
|----------|----------|-------------|------------|
| HIGH | `openDealFilters.ts` | Company/contact sidebar Deals 400 | PostgREST `stage@nin` invalid; use `stage@in` with open stage list |
| MEDIUM | Terminology | "Deals" vs "Projects" vs `/projects` redirect | Same `deals` table, mixed copy |
| MEDIUM | FakeRest | Convert lead no deal in demo | `fakerest/dataProvider` omits deal on convert |
| LOW | `normalizeProjectPayload` | Forces `lifecycle_phase=opportunity` | Correct for open deals; convert uses raw `buildDealInsertRecord` |
| LOW | Mobile | No deals in mobile nav | `CRM.tsx` mobile resource set |

## 9. Broken connections

- `/projects` → `/deals` redirect only.
- Contractor fields (`subcontractor_ids`, etc.) hidden in LBS UI but may exist on old rows.
- `person_id` not on deals table.
