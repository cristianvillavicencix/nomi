# Tickets

## 1. Purpose

Internal support tickets linked to companies, contacts, and deals. List, create, show, and staff replies — no client-facing portal.

## 2. Files & components

| Kind | Path |
|------|------|
| Routes | `/tickets`, `/tickets/create`, `/tickets/:id/show` |
| Legacy | `/tickets-placeholder` |
| Resource | `Resource name="tickets"` in `CRM.tsx` |
| List | `src/lbs/tickets/TicketsList.tsx` |
| Show / create | `TicketShow.tsx`, `TicketCreate.tsx`, `TicketReplyForm.tsx` |
| Actions | `CreateTicketButton.tsx` |

## 3. Database

| Table / view | Usage |
|--------------|--------|
| `tickets` | CRUD |
| `ticket_messages` | Reply thread via `create("ticket_messages")` |
| FKs | `companies`, `contacts`, `deals`, `organization_members` |

## 4. External services

None. No email ingestion or client portal for tickets.

## 5. Connections to other modules

| Direction | Module | Link |
|-----------|--------|------|
| Links to | Companies / Contacts / Deals | FK on ticket rows |
| Tab counts | Client / Contact sidebars | `countQuery("tickets", …)` |

## 6. Edge functions used by this module

**None.**

## 7. Status: WORKING

CRUD and replies implemented. **`Badge` import fixed** (commit: `fix: TicketsList missing Badge import`, 2026-06-02).

## 8. Issues found

| Severity | Location | User impact | Root cause |
|----------|----------|-------------|------------|
| ~~**CRITICAL**~~ | ~~`TicketsList.tsx:76-87`~~ | ~~List page crash~~ | **Fixed** — `Badge` import added |
| LOW | `ModuleInfoPopover` | Misleading “placeholder” copy | Still references `LBS_PLACEHOLDER_MODULES.tickets` |
| LOW | Product gap | No client ticket portal | By design — internal only |

## 9. Broken connections

- Sidebar tab counts use `contact_id@eq` / `company_id@eq` — OK.
- No edge/email integration for ticket notifications.
