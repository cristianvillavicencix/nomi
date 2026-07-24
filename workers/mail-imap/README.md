# Mail IMAP/SMTP worker

Long-lived worker for CRM Mail accounts with `provider = imap`.

## What it does

- `POST /sync` — `{ account_id, since?, max_results? }` — IMAP fetch into `mail_threads` / `mail_messages`, uploads file attachments to Storage (`mail-attachments` bucket)
- `POST /send` — `{ account_id, to, cc?, bcc?, subject, body_html }` — SMTP send
- `POST /actions` — `{ account_id, thread_id, action }` — trash, archive, spam, read/star, delete forever (used by Edge `mail_actions`)
- `GET /health` — liveness

## Auth

`Authorization: Bearer <MAIL_IMAP_WORKER_SECRET>`

## Env

| Variable | Required |
|----------|----------|
| `SUPABASE_URL` | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | yes |
| `MAIL_IMAP_WORKER_SECRET` | recommended |
| `PORT` | optional (default 8788) |

## Local

```bash
cd workers/mail-imap
npm install
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm start
```

## Production deploy

**Do not use Render free tier** — it blocks outbound SMTP (ports 465/587). IMAP sync may work; send will fail with connection timeout.

Preferred: [Cloud Run](./CLOUD_RUN.md) (same pattern as `workers/web-audit`).

Tunnel or deploy, then set on Supabase Edge:

```bash
supabase secrets set MAIL_IMAP_WORKER_URL=https://your-worker.example \
  MAIL_IMAP_WORKER_SECRET=... --project-ref <ref>
```

Redeploy `mail_sync` / `mail_send` / `mail_actions` after setting secrets. Restart or redeploy this worker after pulling changes (sync uploads attachments; `/actions` for folder moves).
