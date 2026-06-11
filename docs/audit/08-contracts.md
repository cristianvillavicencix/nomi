# Contracts

## 1. Purpose

Legal agreements linked to proposals and clients. List at `/contracts`, detail at `/contracts/:id/show`. Most contracts are **created automatically** when a proposal is accepted or signed on the public portal—not via a standalone create page. Show view displays status, parties, terms snapshot, and links to company/proposal/deal.

## 2. Files & components

| Area | Paths |
|------|-------|
| List | `src/lbs/contracts/ContractsList.tsx` |
| Show | `src/lbs/contracts/ContractShow.tsx` |
| Resource | `src/lbs/contracts/index.ts` (RA registration) |
| Types | `Contract` in `src/lbs/types.ts` |
| Placeholder | `/contracts-placeholder` — `19-orphaned-routes.md` |

No dedicated create/edit UI in LBS layer—creation is server-side on proposal accept.

## 3. Database

| Table | Key columns |
|-------|-------------|
| `contracts` | `proposal_id`, `company_id`, `contact_id`, `deal_id`, `status`, `signed_at`, `terms_snapshot`, `org_id`, `created_by_member_id` |

**RLS:** Org-scoped SELECT/INSERT/UPDATE consistent with proposals module policies.

**Orphan FK SQL (not executed):**

```sql
SELECT count(*) FROM contracts c
WHERE c.proposal_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM proposals p WHERE p.id = c.proposal_id);
```

## 4. External services

E-signature and terms rendering happen on **public proposal accept** (`sign_proposal_contract` edge function)—not on staff contract show page directly.

## 5. Connections to other modules

| Direction | Module |
|-----------|--------|
| ← Proposals | Accept/sign creates contract |
| → Deals | `deal_id` on contract |
| ↔ Companies/Contacts | FKs |
| Settings | `organization_contract_terms`, commercial settings |

## 6. Edge functions used by this module

| Function | Invoked by | Purpose |
|----------|------------|---------|
| `accept_proposal` | Proposals module | May create contract row on accept |
| `sign_proposal_contract` | Public proposal portal | Signature + contract update |

Staff contract list/show uses **PostgREST only**—no direct edge calls from `ContractsList` / `ContractShow`.

## 7. Status: PARTIAL

List crashed on missing **Badge** import — fixed in working tree. Functional otherwise as read-only management UI.

## 8. Issues found

| Severity | Location | User impact | Root cause |
|----------|----------|-------------|------------|
| CRITICAL | `ContractsList.tsx:85` | Contracts list crash | Missing `import { Badge } from "@/components/ui/badge"` |
| MEDIUM | No create route | Users cannot draft contract outside proposal | By design—may confuse users expecting CRM create |
| LOW | `/contracts-placeholder` | Orphan | Delete candidate |
| LOW | Share modal | `ShareRecordModal` on show | Verify RLS allows share tokens for contracts |

## 9. Broken connections

- None related to `person_id`.
- Contract PDF/download not evident on show page—may live under proposal document only.
