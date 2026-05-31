# Web Audit Worker — Google Cloud Run

Production target for Nomi Web Report (replaces Fly.io).

## Why Cloud Run

- Timeouts up to **15 min** (900s) per request — fits Lighthouse + axe móvil + desktop
- **4 GiB RAM** without Fly autostop killing Chrome mid-audit
- **`--no-cpu-throttling`** — CPU stays on after HTTP 202 while audit runs in background
- **Scale to zero** when idle — no cost between reports
- Region **`us-east1`** aligns with hosted Supabase (`qjglkywmqwqdoaboakao`)

## What you need (one-time)

| Item | Where |
|------|--------|
| **GCP project** | [console.cloud.google.com](https://console.cloud.google.com) — create or reuse (e.g. same project as Google Places / CrUX) |
| **Billing enabled** | Required for Cloud Run (pay per use, ~$0 idle) |
| **gcloud CLI** | [Install SDK](https://cloud.google.com/sdk/docs/install) then `gcloud auth login` |
| **`WEB_AUDIT_WORKER_SECRET`** | Same value on worker + Supabase (generate: `openssl rand -hex 32`) |
| **`GOOGLE_CRUX_API_KEY`** | Optional — [CrUX API](https://developer.chrome.com/docs/crux/api/) in same GCP project |

You do **not** need to search for anything special — just project ID + secrets above.

## Deploy

```bash
cd workers/web-audit

# Required
export GCP_PROJECT_ID="YOUR_GCP_PROJECT_ID"
export WEB_AUDIT_WORKER_SECRET="your-shared-secret"

# Optional
export GOOGLE_CRUX_API_KEY="AIza..."
export GCP_REGION="us-east1"   # default

chmod +x scripts/deploy-cloud-run.sh
./scripts/deploy-cloud-run.sh
```

The script prints the service URL. Then:

```bash
supabase secrets set \
  WEB_AUDIT_WORKER_URL='https://nomi-web-audit-XXXXX-ue.a.run.app' \
  WEB_AUDIT_WORKER_SECRET='your-shared-secret' \
  --project-ref qjglkywmqwqdoaboakao
```

No Supabase redeploy needed — Edge picks up secrets immediately.

## Verify

```bash
curl -s https://YOUR-SERVICE-URL/health
# {"ok":true,"service":"web-audit-worker","timeout_ms":900000,...}
```

In Nomi → Web Monitor → sitio → pestaña **Web Report** → **Generar reporte**.

## Cloud Run settings (reference)

| Flag | Value | Why |
|------|-------|-----|
| `--memory` | 4Gi | Headless Chromium + Lighthouse |
| `--cpu` | 2 | Faster audits on heavy WordPress sites |
| `--timeout` | 900 | 15 min max |
| `--concurrency` | 1 | One audit per instance |
| `--no-cpu-throttling` | on | Background work after 202 response |
| `--allow-unauthenticated` | on | Auth via `Bearer WEB_AUDIT_WORKER_SECRET` (same as Fly) |

## Fly.io (legacy)

`fly.toml` remains for rollback. After Cloud Run is stable, stop Fly:

```bash
fly scale count 0 -a nomi-web-audit
```
