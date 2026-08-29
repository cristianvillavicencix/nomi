# CRM Core — Glossary and surfaces

**Status:** Canonical staff mental model for Account → Person → Deal.  
**Related:** [00-accounts-hub-OVERVIEW.md](./00-accounts-hub-OVERVIEW.md), [accounts-hub-DESIGN-DECISION.md](./accounts-hub-DESIGN-DECISION.md).

## Locked hierarchy

```
Account (companies)          ← bill-to / company record
 └── Person (contacts)       ← people (may be leads or clients)
      └── Deal (deals)       ← opportunity / commercial work in time
```

Account Full also surfaces Deals and Tickets directly under the company; that is the same model (children of Account), not a second CRM.

## Glossary (UI English only)

| Term | Means | Data | Never |
|------|--------|------|--------|
| **Account** | Empresa / bill-to; center of gravity for Full show | `companies` | Nav “Clients”; primary chrome “Company” |
| **Person** | Individual | `contacts` | Separate top-level “Contacts” product door |
| **Lead** | Person **in pipeline** | `contacts.status` / `lead_stage` | Separate entity / second Full show product |
| **Client** | Badge: billable account | `companies.is_client` | Nav item; Kanban column; pipeline stage on company |
| **Deal** | Opportunity in time | `deals` | Re-opening Account as a lead |

### Canonical phrases

- Nav: **Accounts** (List \| Board). Deals/Projects remain a separate commercial door.
- CTAs: **Open Account**, **New account**, **New deal**, **View account**.
- Back from Account / Person Full → **Accounts** (hub).
- Keep **Client** only as status badge or customer-role language (e.g. “Message client”), not as a module name.

## Surfaces inventory

### Canonical

| Surface | Route / entry |
|---------|----------------|
| Accounts List | `/accounts` |
| Accounts Board | `/accounts?view=board` |
| Account Full | `/companies/:id` |
| Person Full | `/contacts/:id/show` |
| Account / Person preview sheets | Hub query params (`?company=`, `?lead=`, …) |
| Find duplicates | `/companies/find-duplicates` |
| Deals / Projects | `/deals…` |

### Redirect / alias (keep URLs, not product doors)

| Legacy | Lands on |
|--------|----------|
| `/clients`, `/companies`, `/contacts` (list) | Accounts List |
| `/leads` | Accounts Board |
| `/leads/create` | Board + create lead |
| `/clients/create`, `/contacts/create` | Accounts create dialogs |
| `/clients/:id…` | `/companies/:id` |
| `/leads/:id/show` | `/contacts/:id/show` (Person Full) |

### Dual / retired as product

| Item | Direction |
|------|-----------|
| Nav **Pipeline** + **Clients** | Removed when hub frozen; aliases only |
| Standalone Clients hub / Leads list as top-level mounts | Stop mounting; reuse board/create internals |
| Separate Lead Full shell | Merge into Person Full; pipeline tab + Convert when lead lifecycle |
| `AccountsPeopleList` people-first hub list | Unused by default hub; do not revive |

## PR rule

If you change Account or Person chrome (labels, back links, create CTAs), update **tickets** and **deals** headers/dialogs and related sidebars in the **same** change so staff never see “Company” on one surface and “Account” on another.

## Non-goals

- No `accounts` table; no companies+contacts schema merge.
- Do not change bill-to FKs (`company_id`).
- Do not rewrite `convertLeadToClient` / RLS as part of glossary work.
- Resource IDs and DB column names (`companies`, `company_id`) stay as-is.
