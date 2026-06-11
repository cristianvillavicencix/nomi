# Companies (Clients)

## 1. Purpose

Client organizations at `/companies` and detail at `/companies/:id`. Company record holds business identity, website, structured addresses, primary contact link, and related sidebar (contacts, deals, leads, projects, tickets, web monitor widgets). Supports create/edit dialogs, duplicate finder, and quick actions (SMS, forms, new deal modal).

## 2. Files & components

| Area | Paths |
|------|-------|
| List | `src/lbs/clients/CompaniesListPage.tsx` |
| Show | `src/lbs/clients/ClientShowPage.tsx`, `ClientShowContent.tsx`, `ClientSummaryCard.tsx` |
| Profile | `ClientProfileHeader.tsx`, `ClientQuickActions.tsx`, `ClientNewMenu.tsx` |
| Sidebar | `ClientRelatedSidebar.tsx`, `ClientCollapsibleRelatedSidebar.tsx` |
| Tabs | `ClientTabPanels.tsx`, `ClientFinancialTab.tsx`, `ClientActivityTab.tsx` |
| Forms | `ClientEditDialog.tsx`, `NewClientDialog.tsx`, `ClientCreateForm.tsx`, `lbsClientUpsert.ts` |
| Contacts tab | `ClientContactsTab.tsx`, `ClientAddContactDialog.tsx` |
| Utils | `clientProfile.ts`, `companyChannelResolvers.ts`, `StructuredAddressFields.tsx` |
| Duplicates | `src/lbs/clients/FindDuplicatesPage.tsx` |
| Counts | `useClientTabCounts.ts` |
| Redirects | `ClientRouteRedirects.tsx`, `CompanyRouteRedirects.tsx` |
| Data | `dataProvider.upsertStandaloneClient`, `persistContactWithCompany` in `dataProvider.ts` |

## 3. Database

| Table | Role |
|-------|------|
| `companies` | Primary entity; `org_id`, `primary_contact_id`, `website`, address JSON, channels |
| `companies_summary` | View for list (avatar, primary contact fields) |
| `contacts` | Related via `company_id`; primary contact FK |
| `deals` | `company_id` FK |
| `proposals`, `contracts`, `tickets`, `client_invoices` | `company_id` FK |
| `monitored_websites` | Optional 1:1 site monitoring |
| `form_submissions_v2` | Intake submissions |

**RLS:** Org isolation via `org_id` and `current_user_org_id()` patterns (see `20260425120000_organizations_multi_tenant.sql`).

**Orphan FK SQL (not executed):**

```sql
SELECT count(*) FROM deals d
WHERE d.company_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM companies c WHERE c.id = d.company_id);
```

## 4. External services

| Service | Usage |
|---------|--------|
| Google Places | Company name/address — `src/lib/googlePlaces/`, `google_places` edge function |
| Website favicons | `getCompanyAvatar`, gstatic (404s benign) |
| Send Form v2 | `SendFormButton` on profile |
| Twilio SMS | `OpenClientSmsButton` |

## 5. Connections to other modules

| Direction | Module |
|-----------|--------|
| → Contacts | Primary contact, contacts tab, add contact |
| → Deals | Sidebar Deals/Projects, New Deal modal |
| → Leads | Sidebar leads at same company |
| → Proposals/Billing/Tickets | Financial tab, related counts |
| → Web Monitor | Sidebar widgets when enabled |
| ← Leads | Convert creates/links company |

## 6. Edge functions used by this module

| Function | Caller | Purpose |
|----------|--------|---------|
| `google_places` | `src/lib/googlePlaces/edgeProxy.ts` | Places autocomplete |
| `merge_contacts` | `FindDuplicatesPage` → `dataProvider.mergeContacts` | Duplicate merge (contact-level, company page entry) |
| `generate_form_token` / `submit_form_v2` | Indirect via Send Form / web forms linked to company | Client intake |

**Direct Supabase (no edge):** company CRUD via PostgREST; `upsertStandaloneClient` in dataProvider.

## 7. Status: PARTIAL

Company show and list functional. **Deals sidebar filter** had PostgREST 400 (`stage@nin`) — fixed to `stage@in` in working tree (`openDealFilters.ts`).

## 8. Issues found

| Severity | Location | User impact | Root cause |
|----------|----------|-------------|------------|
| HIGH | `openDealFilters.ts` (sidebar) | Deals section empty / error toast | Invalid PostgREST `nin` operator; fixed with `stage@in` open stages |
| MEDIUM | `ClientRelatedSidebar.tsx` | Overlap "Deals" vs "Projects" sections | Both list deals with different filters — UX confusion |
| LOW | Favicon 404s | Broken avatars in list | Legacy gstatic URLs / sites without favicon |
| LOW | `/companies/create` | Redirect only | Legacy path via `CompanyRouteRedirects` |

## 9. Broken connections

- Legacy `/clients/*` redirects active (`vercel.json` + in-app).
- `person_id` not used on companies table.
- `ImportPage` not linked from company UI.
