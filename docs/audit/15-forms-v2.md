# Forms v2

## 1. Purpose

Build and publish multi-step forms, collect submissions, analytics, short links, and embed script for external sites. Replaces deprecated `src/lbs/web-forms/`.

## 2. Files & components

| Kind | Path |
|------|------|
| Staff routes | `/forms-v2`, `/forms-v2/new`, `/forms-v2/:id/edit`, `/forms-v2/submissions`, `/forms-v2/submissions/:id`, `/forms-v2/:id/analytics` |
| Redirect | `/web-forms` → `/forms-v2` |
| Public | `/forms/:slug`, `/f/:shortCode` (noLayout) |
| Settings entry | Settings → Forms tab embeds `FormsListPage` |
| Builder | `src/lbs/forms-v2/builder/` |
| Public | `src/lbs/forms-v2/public/` |
| Submissions | `src/lbs/forms-v2/submissions/` |

Ghost resources in CRM: `forms`, `form_submissions`, `form_instances`, etc.

## 3. Database

| Table / view | Usage |
|--------------|--------|
| `form_instances`, `form_instance_versions`, `form_templates` | Builder + publish |
| `form_submissions_v2`, `form_submission_events` | Submissions + analytics events |
| `public_form_tokens` | Signed public access |

## 4. External services

- **Public embed:** `forms_embed_js` edge function (script URL on third-party sites).
- **File uploads:** Supabase storage via `upload_form_file`.

## 5. Connections to other modules

| Direction | Module | Link |
|-----------|--------|------|
| Links to | Companies / Contacts / Deals | Submission FKs; token generation |
| Links to | Messages | SMS form picker |
| Client tabs | Companies | `form_submissions_v2` tab counts |

## 6. Edge functions used by this module

| Function | Invoked from | Purpose |
|----------|--------------|---------|
| `get_form_by_token` | `dataProvider.getFormByToken()` | Public form load |
| `submit_form_v2` | `dataProvider.submitFormV2()` | Public submit |
| `generate_form_token` | `dataProvider.generateFormToken()` | Staff share links |
| `record_form_event` | `dataProvider.recordFormEvent()` | Analytics events |
| `upload_form_file` | `uploadFormFile.ts` | Public file fields |
| `resolve_short_code` | `ShortUrlRedirect.tsx` (raw fetch) | `/f/:code` |
| `forms_embed_js` | External `<script src=…>` | Embed (not imported in app) |

## 7. Status: WORKING

Builder, public submit, submissions list, and analytics functional. **Discoverability is weak** — no top-level sidebar item.

## 8. Issues found

| Severity | Location | User impact | Root cause |
|----------|----------|-------------|------------|
| LOW | Navigation | Hard to find forms | No sidebar link; only Settings tab + deep URLs |
| LOW | Route guards | `resource="forms"` vs `form_instances` data | Catalog maps both to `forms.manage` — OK |
| LOW | Submissions filter | `utm_source@ilike` with manual `%` | See `20-data-provider.md` — may double-wrap with ra-data-postgrest |

## 9. Broken connections

- Public forms require token/signed link for gated forms — expected.
- Analytics uses direct Supabase queries (`formAnalyticsQueries.ts`) — separate from dataProvider filters.
