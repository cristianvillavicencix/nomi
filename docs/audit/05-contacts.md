# Contacts

## 1. Purpose

People records at `/contacts` (client contacts, not leads). Detail view at `/contacts/:id/show` with company sidebar, deals, tickets, referrals. Supports create/edit dialogs, merge duplicates, and links to company primary contact. Distinct from **Leads** module (same `contacts` table, filtered by `status`).

## 2. Files & components

| Area | Paths |
|------|-------|
| List | `src/lbs/clients/ContactsListPage.tsx` (shared list page path) |
| Show | `src/lbs/contacts/ContactShowPage.tsx`, `ContactShowContent.tsx` |
| Sidebar | `ContactRelatedSidebar.tsx`, `ContactCollapsibleRelatedSidebar.tsx` |
| Forms | `ContactFormDialog.tsx`, `LbsContactFormFields.tsx`, `ContactCompanyPickerField.tsx` |
| Merge | `src/components/atomic-crm/providers/commons/mergeContacts.ts`, `contactDuplicateUtils.ts` |
| Profile card | `ContactSummaryCard.tsx`, `ContactCompanySidebar.tsx` |
| Counts | `useContactTabCounts.ts` |
| Legacy RA | `src/components/atomic-crm/contacts/ContactEdit.tsx` (`/contacts/:id`) |
| Dead | `ContactQuickViewPage.tsx` — **no route** (see `19-orphaned-routes.md`) |

## 3. Database

| Table | Role |
|-------|------|
| `contacts` | Core row: names, channels (`email_jsonb`, `phone_jsonb`), `company_id`, `status`, `org_id`, `organization_member_id` |
| `contacts_summary` | List view with company meta, task counts |
| `contact_notes` | Activity / notes |
| `tasks` | `contact_id` FK |
| `deals` | `contact_id`, `contact_ids[]` |
| `task_assignees` | Legacy `person_id` → contacts (still in schema; writes often `null`) |

**RLS:** Org-scoped; summary view respects same policies as `contacts`.

**Orphan FK SQL (not executed):**

```sql
SELECT count(*) FROM contacts c
WHERE c.company_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM companies co WHERE co.id = c.company_id);
```

## 4. External services

Google Places on contact/company forms (shared). SMS via Messages module.

## 5. Connections to other modules

| Direction | Module |
|-----------|--------|
| ↔ Companies | `company_id`, primary contact inverse |
| → Deals | Sidebar deals, `contact_ids` on deals |
| → Tasks / Notes | Activity tabs |
| → Leads | Same table; status filter separates modules |
| → Referrals | `referred_by_contact_id` |

## 6. Edge functions used by this module

| Function | Caller | Purpose |
|----------|--------|---------|
| `merge_contacts` | `dataProvider.mergeContacts` | Merge duplicate contacts (edge transaction) |

All other contact CRUD via PostgREST. **`users`** edge function is Settings/Users module, not contact show.

## 7. Status: PARTIAL

Contact show/list work. **`getOne` with invalid id** returns 406 in related flows (proposals linking) — see Proposals/Billing audits.

## 8. Issues found

| Severity | Location | User impact | Root cause |
|----------|----------|-------------|------------|
| HIGH | `dataProvider.getOne("contacts")` | "Contact not found" on proposal links | Empty/invalid id passed; `isValidRecordId` guard added in working tree |
| MEDIUM | `ContactQuickViewPage.tsx` | Dead code | Never registered in router |
| LOW | `/contacts/:id` RA edit | Legacy full-page edit | Parallel to show + dialog pattern |
| LOW | `task_assignees.person_id` | Legacy column | Revert leftover; app uses `organization_member_id` on tasks |

## 9. Broken connections

- `calendarEventWriteData.ts` strips legacy `person_id` on calendar writes — OK.
- Merge flow expects edge function deployed; fails closed if `merge_contacts` missing.
