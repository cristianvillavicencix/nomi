# Mail IMAP/SMTP worker — Google Cloud Run

Production target for Hostinger (and other) IMAP mailboxes. **Do not use Render free tier for this worker** — Render blocks outbound SMTP on ports 465 and 587 (IMAP sync may work; send will timeout).

## Why Cloud Run

- Outbound **SMTP 465/587** works (required for send)
- Same GCP project / region as `nomi-web-audit` (`us-east1`)
- Scale to zero when idle

## Deploy

```bash
cd workers/mail-imap

export GCP_PROJECT_ID="nomi-c5f2d"
export MAIL_IMAP_WORKER_SECRET="your-shared-secret"
export SUPABASE_URL="https://qjglkywmqwqdoaboakao.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="..."

chmod +x scripts/deploy-cloud-run.sh
./scripts/deploy-cloud-run.sh
```

Then update Supabase:

```bash
supabase secrets set \
  MAIL_IMAP_WORKER_URL='https://nomi-mail-imap-XXXXX-ue.a.run.app' \
  MAIL_IMAP_WORKER_SECRET='your-shared-secret' \
  --project-ref qjglkywmqwqdoaboakao
```

No Edge redeploy needed — secrets apply immediately.

## Verify

```bash
curl -s https://YOUR-SERVICE-URL/health
```

In Nomi → Mail → compose → Send (Hostinger / IMAP account).

## Repair IMAP unread state (one-time)

If threads were marked unread again after sync before the read-state fix, run once in Supabase SQL:

```sql
update public.mail_threads t
set is_unread = exists (
  select 1 from public.mail_messages m
  where m.thread_id = t.id and m.is_read = false
)
where exists (
  select 1 from public.mail_accounts a
  where a.id = t.account_id and a.provider = 'imap'
);
```

Then open a message in Mail and use refresh — unread badges should stay correct after sync.

## Render (legacy — send broken on free tier)

If `MAIL_IMAP_WORKER_URL` points to `https://mail-imap.onrender.com`, sync (IMAP 993) can work but **send fails** with `SMTP connection failed … Connection timeout`. Upgrade Render to a **paid** instance or migrate to Cloud Run.
