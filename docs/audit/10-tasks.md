# Tasks

## 1. Purpose

Org-wide task management: list, create, edit, assign, @mention, tag notifications, and scoped views (mine, tagged, my projects). Embedded in dashboard (`LbsDashboardTasks`), contact/deal sidebars, and a mini-calendar panel on the task list.

## 2. Files & components

| Kind | Path |
|------|------|
| Resource | `Resource name="tasks"` in `src/components/atomic-crm/root/CRM.tsx` |
| Route | `/tasks` |
| Module index | `src/components/atomic-crm/tasks/index.tsx` |
| List / table | `TaskList.tsx`, `TaskTable.tsx`, `TaskFilters.tsx` |
| Create / edit | `TaskCreateSheet.tsx`, `TaskEditSheet.tsx`, `TaskFormFields.tsx` |
| Mentions | `TaskDescriptionMentionInput.tsx`, `taskAssignments.ts`, `taskParticipants.ts` |
| Scoped fetch | `useScopedTasks.ts` → `dataProvider.getScopedTasks()` |
| Side effects | `persistTaskAssignmentSideEffects.ts` |
| Dashboard widget | `src/lbs/dashboard/LbsDashboardTasks.tsx` |
| Mobile | `MobileTasksList.tsx` (list only; no LBS custom routes on mobile admin) |

## 3. Database

| Table / view | Usage |
|--------------|--------|
| `tasks` | CRUD, scoped queries, calendar due dates |
| `task_participants` | Per-user completion state |
| `task_tag_notifications` | @mention unread tracking |
| `deals` | Project filter / `my_projects` scope |
| `contacts`, `organization_members` | Display references |

RLS: org-scoped via standard CRM policies on `tasks` and related tables.

## 4. External services

None directly. Notifications are in-app (tag notifications table), not push/email from this module.

## 5. Connections to other modules

| Direction | Module | Link |
|-----------|--------|------|
| Links to | Deals | `deal_id` on tasks; project-scoped filters |
| Links to | Contacts | Contact references on tasks |
| Links to | Calendar | Due dates shown on `/calendar`; tasks panel in task list |
| Links to | Dashboard | `LbsDashboardTasks` widget |
| Reads | Settings | Task types from configuration |

## 6. Edge functions used by this module

**None.** All CRUD via PostgREST / custom `getScopedTasks()` (direct Supabase client, bypasses react-admin filter serialization).

## 7. Status: WORKING

Desktop task list, scoped filters, mentions, and tag notifications are implemented. `getScopedTasks` uses Supabase query builder (`.eq`, `.in`, `.or`, `.cs`) — not `@operator` filter strings.

## 8. Issues found

| Severity | Location | User impact | Root cause |
|----------|----------|-------------|------------|
| LOW | Mobile admin | No full task edit on mobile shell | `MobileAdmin` only registers contacts/companies/tasks list |
| LOW | `TaskList.tsx` | Complex mention UX | Many code paths for legacy `mentioned_member_ids` vs participants |
| MEDIUM | Scoped tasks vs list | Two query paths | `getList("tasks")` uses PostgREST filters; `getScopedTasks` uses raw client — behavior can diverge if filters added to list only |

## 9. Broken connections

- Task types/priorities from `configuration` — OK when config loaded.
- Tag notification read state depends on `task_tag_notifications` RLS — verify for non-admin roles in QA.
