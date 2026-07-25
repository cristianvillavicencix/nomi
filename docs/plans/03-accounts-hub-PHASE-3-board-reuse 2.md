# Phase 3 — Board reuse (leads Kanban)

**Status:** Plan only  
**Risk:** Low–medium (routing / double chrome)  
**Depends on:** Phase 1 hub shell  
**Independent of:** Phase 2 (can ship before or after grouped list)  
**DB migrations:** None

## Goal

Expose the **existing leads Kanban** as Accounts **Board** mode. Columns remain `contacts.lead_stage` (people/opportunities). **Do not** put companies on the board.

## Locked board rules

| Rule | Detail |
|------|--------|
| Entity on cards | `contacts` with lead lifecycle / pipeline filters (same as today’s `/leads`) |
| Columns | `LBS_LEAD_KANBAN_BOARD_STAGES` from `src/modules/leads/leadStages.ts` |
| Stage change | Existing dialogs: `LeadStageChangeDialog`, `applyLeadStageChange.ts` |
| Won convert | `ConvertWonLeadDialog` / `convertLeadToClient` — unchanged |
| Anti-Olvido | `snooze_until`, follow-up fields, enrichment in `useLeadKanbanEnrichment.ts` — unchanged |
| Terminal stages | Won/Lost handled as today (not board columns for drag targets per current `LeadsKanban` comments) |

## Product behavior

1. Accounts hub **Board** tab/toggle mounts the same board UX users know from Pipeline.
2. Prefer **embed** over iframe/navigation away: user stays under Accounts chrome.
3. Split layout / show-in-kanban (`LeadsKanbanSplitLayout`, `getLeadKanbanShowPath`) keep working:
   - Today: `/leads/:id/show?stage=…`
   - Keep these URLs; optionally also support `/accounts/:id/show?view=board&stage=…` later — **not required** for Phase 3.
4. Creating a lead from Board uses existing `NewLeadDialog` / `?create=lead`.
5. After convert to client, navigate to `getClientShowPath(company_id)` as today (`ConvertLeadButton`, kanban won flow).

## Implementation approach

### Recommended: extract presentational board from `LeadsListPage`

Today `LeadsListPage.tsx`:

- Owns `view` state (`table` | `kanban`) via `lbs.leads.view`
- Wraps `<List resource="contacts" storeKey="leads.listParams" …>`
- Renders `LeadsKanban` / table / standalone show

Phase 3 plan:

1. Extract `LeadsBoardPanel` (or reuse `LeadsKanban` + list wrapper) that assumes a parent `<List resource="contacts">`.
2. `AccountsHubPage` Board mode renders that panel with the **same** `storeKey` (`leads.listParams`) so filters/bookmarks stay coherent when redirecting from `/leads`.
3. `LeadsListPage` becomes a thin redirect to `/accounts?view=board` **or** a re-export of the board panel for backwards compatibility during rollout.
4. Strip duplicate `PageTitle` / ModuleInfo when embedded under Accounts.

### Explicitly out of scope

- Company Kanban columns
- Changing `lead_stage` enum / trigger `trg_sync_deal_to_lead_stage`
- Moving convert logic to an edge function (see `DEFERRED_NOTES.md`)
- Reworking Anti-Olvido semantics

## Files likely touched

| File | Change |
|------|--------|
| `src/modules/leads/LeadsListPage.tsx` | Extract embeddable board; optional redirect |
| `src/modules/leads/LeadsKanban.tsx` | Usually untouched; verify embed |
| `src/modules/leads/LeadsKanbanSplitLayout.tsx` | Title/chrome when hub-hosted |
| `src/modules/leads/leadKanbanNavigation.ts` | Path helpers if accounts URLs added |
| `src/modules/accounts/AccountsHubPage.tsx` | Board mode host |
| `src/app/LbsCustomRoutes.tsx` | `/leads` → board hub redirect (if not done in Phase 1) |
| `src/app/routing.ts` | `getLeadsListPath()` → accounts board URL |
| `src/modules/dashboard/DashboardLeadsCard.tsx` | Links still land on board |

## Acceptance criteria

- [ ] Board mode shows same stages/order as current Pipeline kanban.
- [ ] Drag → stage dialog → persist `lead_stage` / follow-up / note / task as today.
- [ ] Won convert still calls `convertLeadToClient` and lands on company show.
- [ ] Anti-Olvido overdue/follow-up display on cards unchanged.
- [ ] Deal stage changes still sync lead stage via existing DB triggers (smoke-test one deal).
- [ ] `/leads` deep links reach the board.
- [ ] `/leads/:id/show?stage=` split view still works on desktop; mobile standalone show still works.
- [ ] No companies-as-columns UI.
- [ ] No DB migration.

## No-regression focus

| Flow | Source |
|------|--------|
| Stage change required fields | `leadStageTransitionConfig.ts` |
| Kanban enrichment (assignees, SMS) | `useLeadKanbanEnrichment.ts` |
| Legacy filter cleanup | `LEGACY_FOLLOW_UP_FILTER_KEYS` in `LeadsListPage` |
| FakeRest convert without deal | Documented divergence — do not “fix” by changing Supabase path |

## Estimated effort

~1–2 days if Phase 1 already embeds; ~2–3 if extraction + redirect edge cases (create query, stage param, mobile).

## Risk notes

| Risk | Mitigation |
|------|------------|
| Double headers / double List providers | Single `<List>` owner; embed only children |
| storeKey fork breaks saved filters | Keep `leads.listParams` |
| Users bookmark `/leads` table view | Redirect preserves `view` or map table → Accounts List later |
