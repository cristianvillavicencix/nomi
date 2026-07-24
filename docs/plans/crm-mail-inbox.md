# CRM Mail Inbox

Unified mail client for organization and personal mailboxes. Separate from ticket inbound (`ticket_inboxes` / Postmark).

## Product

- **Settings → Connectors → Mailboxes**: Connect Google, Microsoft, or IMAP/SMTP.
- **Mail** module (`/mail`): unified inbox (read, compose, reply, search, labels, bulk actions).
- Tokens never leave Edge / Vault-style `token_payload`; clients use `mail_accounts_safe`.

## Phases

| Phase | Status |
|-------|--------|
| 0 Schema, RLS, permissions, nav, Settings panel, Mail shell | Done |
| 1 Google + Microsoft OAuth, `mail_sync`, read UI | Done |
| 2 Compose / reply / drafts / `mail_send` | Done |
| 3 IMAP/SMTP Settings wizard + worker hook | Done (worker optional; SMTP retries 465/587) |
| Sent folder (sync + UI) | Done (Gmail `in:sent`, Graph `sentitems`, IMAP Sent mailbox) |
| Compose polish (chips, Cc/Bcc, contextual format, solid Send, attachments) | Done (≤5 files, 4 MB each, 8 MB total; Gmail/Graph/IMAP) |
| HTML render fidelity | Done (Gmail `attachmentId` bodies, Graph HTML Prefer, CID strip, ticket-style sanitize, single light canvas) |
| 4 Labels, FTS search, bulk actions, ticket bridge flag | Done |
| 5 Sync health, retention RPC, docs, smoke notes | Done |

## Operator setup (engineering)

End users never paste client IDs. Configure once on the hosted Supabase project:

### Google

1. Google Cloud Console → OAuth client (Web).
2. Authorized redirect URI: `https://<project-ref>.supabase.co/functions/v1/mail_oauth`
3. Enable Gmail API.
4. Secrets:
   - `MAIL_GOOGLE_CLIENT_ID`
   - `MAIL_GOOGLE_CLIENT_SECRET`
   - (optional fallback) reuses `GOOGLE_GSC_CLIENT_ID` / `GOOGLE_GSC_CLIENT_SECRET` if Mail secrets unset

### Microsoft

1. Azure App Registration → Web redirect: same `mail_oauth` URI.
2. API permissions (delegated): `Mail.ReadWrite`, `Mail.Send`, **`User.Read`**, `openid`, `email`, `offline_access`.
3. Supported account types: org + personal Microsoft accounts if connecting Outlook.com mailboxes.
4. Secrets:
   - `MAIL_MICROSOFT_CLIENT_ID`
   - `MAIL_MICROSOFT_CLIENT_SECRET`

### App return URL

- `MAIL_OAUTH_APP_ORIGIN` or `PUBLIC_APP_URL` → e.g. `https://lbs.bz` or `http://localhost:5174`

### IMAP worker

Deploy `workers/mail-imap` (Cloud Run or local + tunnel). It performs real IMAP fetch (with `since` date) and SMTP send.

Set on Supabase Edge:

- `MAIL_IMAP_WORKER_URL`
- `MAIL_IMAP_WORKER_SECRET`

Without the worker, IMAP accounts can still be **connected** in Settings; sync will explain that the worker is required.

### Sync date range

After connect (or **Sync now…** / Mail **Sync…**), the UI asks **Sync mail from…** (7 / 30 / 90 / 365 days, custom date, or capped “as much as possible”). That `since` value is passed to `mail_sync` (Gmail `after:`, Graph `$filter`, IMAP worker `SINCE`).

### Cron (near-live)

Scheduled every minute via pg_cron (`mail_sync_every_minute` → `invoke_mail_sync_cron`). Reuses vault secrets `website_monitor_project_url` + `website_monitor_cron_secret`. Edge `mail_sync` accepts `x-cron-secret` matching `CRON_SECRET` (same value as the vault cron secret) or a service-role bearer.

Accounts sync when `last_sync_at` is null or older than **1 minute**. Cron uses an incremental lookback from `last_sync_at` (1h overlap), not the original bulk-sync date. Concurrent syncs for the same account are skipped. While `/mail` is open, the thread list also refetches every 30s.

Manual invoke:

```http
POST /functions/v1/mail_sync
x-cron-secret: <CRON_SECRET>
Content-Type: application/json

{ "action": "cron", "limit": 20 }
```

After deploying decode fixes, run **Sync…** once per mailbox to refresh stored bodies (UTF-8 / HTML).

### Retention

```sql
select public.mail_purge_trashed(90);
```

## Edge functions

| Function | Role |
|----------|------|
| `mail_oauth` | start / callback / disconnect / status |
| `mail_sync` | incremental sync + cron batch |
| `mail_send` | send + drafts |
| `mail_imap` | test + connect IMAP/SMTP |

`verify_jwt = false` in `config.toml` (auth checked inside handlers). Deploy:

```bash
npx supabase functions deploy mail_oauth mail_sync mail_send mail_imap --project-ref <ref>
```

## Permissions

- `mail.org.view` | `mail.org.send` | `mail.org.manage`
- `mail.personal.view` | `mail.personal.send` | `mail.personal.manage`

## Smoke checklist

1. Settings → Mailboxes → Connect Google (sandbox) → toast “Mailbox connected”.
2. Open Mail → account filter shows mailbox; threads appear after sync.
3. Mark read; Compose reply; Send.
4. Add other account (IMAP) with app password → Test & connect.
5. Search subject; bulk archive; Sync health shows jobs.
6. Confirm ticket inbound / Postmark paths unchanged.

## Non-goals

- Not an ESP / MX host.
- Does not replace helpdesk ticket inbound.
- No reading other members’ personal mail by default.
