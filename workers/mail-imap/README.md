# Mail IMAP/SMTP worker

Long-lived worker for CRM Mail accounts with `provider = imap`.

## What it does

- `POST /sync` — `{ account_id, since?, max_results? }` — IMAP fetch into `mail_threads` / `mail_messages`
- `POST /send` — `{ account_id, to, cc?, bcc?, subject, body_html }` — SMTP send
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

Tunnel or deploy (Cloud Run), then set on Supabase Edge:

```bash
supabase secrets set MAIL_IMAP_WORKER_URL=https://your-worker.example \
  MAIL_IMAP_WORKER_SECRET=... --project-ref <ref>
```

Redeploy `mail_sync` / `mail_send` after setting secrets.
