# Private file URLs — smoke checklist

Run after deploying Fase 1 (frontend) and Fase 2 (migration + edge + Vercel rewrite).

## CRM internal (Fase 1)

- [x] Mail → Sent → open PDF attachment (address bar should not show `supabase.co`)
- [x] Mail → message with inline `cid:` images renders correctly
- [x] Messaging → download SMS/media attachment
- [x] Deals → project resource lightbox preview + download
- [x] Client portal → download file (button, not direct Supabase href)

## External links (Fase 2)

- [x] Ticket reply with large attachment → email link is `www.nomicrm.com/files/...`
- [x] Ticket delivery email → download link works
- [x] Client portal API resources → `download_url` uses `/files/` prefix
- [x] Public form file upload → returned `url` uses `/files/` prefix

## Regression grep

```bash
rg 'window\.open\(.*signedUrl' src/
rg 'createStorageSignedUrl' supabase/functions/_shared/ticketReplyDownloadLinks.ts
```

Both should return no matches in those paths.

## Automated verification (2026-07-24)

- [x] `npm run test -- --run src/modules/mail/ src/lib/supabase/privateStorageFile.test.ts` — 35 passed
- [x] `npx tsc --noEmit` — OK
- [x] `rg 'window\.open\(.*signedUrl' src/` — no matches
- [x] `rg 'supabase\.co/storage/v1/object/sign' src/` — no matches
- [x] `file_download?token=invalid` → HTTP 404
- [x] Edge functions deployed: `file_download`, `reply_ticket`, `deliver_ticket`, `client_portal`, `upload_form_file`, `submit_project_resources`, billing delivery functions
- [x] Vercel production deploy — `https://www.nomicrm.com/files/:token` returns 404 from `file_download` (not SPA `index.html`)

## Manual UI checks (2026-07-24)

All manual smoke items passed in production.

## Secondary hardening (2026-07-24)

- [x] `email_inbound/parseSendGridInbound.ts` — store storage path in `src`, not signed URLs
- [x] `file_download` — IP rate limit (30 req/min) via `file_download_request_log`
- [x] pg_cron daily purge of expired tokens + old request logs
- [x] `uploadFormFile.ts` — removed legacy signed-URL upload path (token-only)

## Ticket attachment hardening (2026-07-27)

### Code changes

- [x] `privateStorageFile.ts` — parse legacy `/object/public/{bucket}/…` URLs before treating as external
- [x] `buildStorageObjectReference` — path-only identifiers for new uploads
- [x] `TicketBillingSidePanel` — deliverable download via `downloadPrivateStorageFile`
- [x] `ProposalImageDropZone`, `AttachmentField`, avatar lists — signed URLs
- [x] `ticketDelivery.ts` / `client_portal` — no raw Supabase `src` fallbacks in email/API links
- [x] Migration `20260727180000_normalize_legacy_storage_references.sql`

### Manual checks

- [ ] Ticket reply → upload PDF → open attachment pill (no `/object/public/` in address bar)
- [ ] Ticket billing → deliverable download button works
- [ ] Legacy row with old public URL still opens after migration backfill
- [ ] Proposal image preview loads for uploaded images
- [ ] Deal card / ticket assignee avatars render for uploaded avatars

### Automated

```bash
npm run typecheck
npm run test -- --run src/lib/supabase/privateStorageFile.test.ts
rg 'href=\{.*\.src\}' src/modules/tickets/
rg 'object/public/attachments' src/ supabase/functions/ --glob '!* 2.*'
```

Deploy after merge: apply migration, redeploy `deliver_ticket` + `client_portal` edge functions.
