# Proposals

## 1. Purpose

Commercial quotes at `/proposals`: list, create, edit, internal preview, and send to clients. Public flow at `/proposal/:token` (view, e-sign, deposit). Accepting a proposal creates/activates a **deal** and **contract** via edge functions. Builder uses document sections, line items, payment schedules, and PDF export.

## 2. Files & components

| Area | Paths |
|------|-------|
| List | `src/lbs/proposals/ProposalsList.tsx` |
| CRUD | `ProposalCreate.tsx`, `ProposalEdit.tsx`, `ProposalViewPage.tsx`, `ProposalBuilderForm.tsx` |
| Document | `src/lbs/proposals/document/*` (sections, preview, accept UI) |
| Public | `src/lbs/proposals/public/PublicProposalPage.tsx`, `PublicProposalAcceptPage.tsx`, `publicProposalApi.ts` |
| Send | `ProposalSendActions.tsx`, `dataProvider.sendProposal` |
| Commercial | `saveProposalCommercial.ts`, `ProposalLineItemsEditor.tsx`, `proposalCommercialConstants.ts` |
| Short URL | `ProposalShortUrlRedirect.tsx` |
| Placeholder | `/proposals-placeholder` — see `19-orphaned-routes.md` |

## 3. Database

| Table | Role |
|-------|------|
| `proposals` | Header: `company_id`, `contact_id`, `deal_id`, `status`, `amount`, tokens, content JSON |
| `proposal_line_items` | Line items |
| `proposal_payment_schedules` / `proposal_payment_installments` | Payment plan |
| `proposal_templates` | Reusable templates |
| `service_packages`, `service_addons` | Catalog |
| `organization_contract_terms` | Default terms |
| `contracts` | Created on accept/sign |
| `deals` | Linked/activated on accept |

**RLS:** Org-scoped on proposals and children; public access via token tables + edge functions (service role inside functions).

## 4. External services

| Service | Usage |
|---------|--------|
| Stripe | Client deposit / billing mode on public accept (`pay_proposal_deposit`) |
| Email | `send_proposal` edge function |
| PDF | Client-side `proposalPdfExport.ts` |

## 5. Connections to other modules

| Direction | Module |
|-----------|--------|
| → Deals | Accept creates/updates deal |
| → Contracts | Sign flow creates contract row |
| → Billing | Installments → `client_invoices` sync via `issue_client_invoice` |
| ↔ Companies/Contacts | FKs on proposal |
| → Settings | Commercial tab, catalog, contract terms |

## 6. Edge functions used by this module

| Function | Caller | Purpose |
|----------|--------|---------|
| `send_proposal` | `dataProvider.sendProposal` | Email + public token |
| `get_public_proposal` | `publicProposalApi.ts` | Public view (+ short code resolve) |
| `accept_proposal` | `publicProposalApi`, `dataProvider.acceptProposal` | Staff + public accept |
| `sign_proposal_contract` | `publicProposalApi.ts` | E-sign on public page |
| `pay_proposal_deposit` | `publicProposalApi.ts` | Stripe deposit |
| `issue_client_invoice` | `dataProvider.syncProposalInvoices` | Sync installments to invoices |

**Cron (indirect):** `process_scheduled_payments` charges installments after acceptance.

## 7. Status: PARTIAL

List had **MoneyText** missing import (crash) — fixed in working tree. **406 on getOne** when hooks pass empty proposal/contact id.

## 8. Issues found

| Severity | Location | User impact | Root cause |
|----------|----------|-------------|------------|
| CRITICAL | `ProposalsList.tsx:106` | Proposals list white screen | Missing `MoneyText` import |
| HIGH | Proposal hooks + `dataProvider.getOne` | 406 / console errors | `getOne` with empty id; fixed with `isValidRecordId` in working tree |
| MEDIUM | `getOne` proposals | Same 406 pattern | `useProposalDocumentData` etc. — verify all `enabled` guards |
| LOW | `/proposals-placeholder` | Orphan route | Rollout stub |

## 9. Broken connections

- Public API uses `fetch` to edge with anon key — correct pattern.
- `resolvePublicProposalShortCode` calls `get_public_proposal` with `short_code` — verify edge supports both token and short_code (confirmed in `publicProposalApi.ts`).
