# Private file URLs — smoke checklist

Run after deploying Fase 1 (frontend) and Fase 2 (migration + edge + Vercel rewrite).

## CRM internal (Fase 1)

- [ ] Mail → Sent → open PDF attachment (address bar should not show `supabase.co`)
- [ ] Mail → message with inline `cid:` images renders correctly
- [ ] Messaging → download SMS/media attachment
- [ ] Deals → project resource lightbox preview + download
- [ ] Client portal → download file (button, not direct Supabase href)

## External links (Fase 2)

- [ ] Ticket reply with large attachment → email link is `www.nomicrm.com/files/...`
- [ ] Ticket delivery email → download link works
- [ ] Client portal API resources → `download_url` uses `/files/` prefix
- [ ] Public form file upload → returned `url` uses `/files/` prefix

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

**Manual UI checks** (run in the CRM after login):
