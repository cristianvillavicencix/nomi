# Web Audit Worker

Node worker for Nomi **Web Report** audits. Runs outside Supabase Edge (Chromium + Lighthouse).

## What it does

### Phase 1

1. **Static analysis** (Cheerio): meta tags, H1, viewport, robots/sitemap, images without `alt`.
2. **Lighthouse** (mobile by default): performance, SEO, best practices, accessibility + lab CWV.
3. **Callback** to Supabase Edge `website_audit_callback` with retry + exponential backoff.

### Phase 2

4. **axe-core** (same Chromium via CDP): detailed a11y violations → `axe_json` + `audit_findings` (`source=axe`).
5. **CrUX API** (url → origin fallback): real-user CWV when available → `field_*`, `crux_json.crux_data_level`.
6. **Commercial copy** (static EN templates): `commercial_message` on critical findings for homeowner PDFs.

## Requirements

- Node 20+ (local dev)
- Chromium/Chrome (local) or Docker image (production)
- Shared secret with Supabase Edge (`WEB_AUDIT_WORKER_SECRET`)

---

## Deploy on Fly.io (production)

Nomi uses **hosted Supabase** even locally; the worker must be **publicly reachable** from Edge Functions.

### 1. Install Fly CLI and log in

```bash
curl -L https://fly.io/install.sh | sh
fly auth login
```

### 2. Create the app (first time only)

From this directory:

```bash
cd workers/web-audit
fly launch --no-deploy
```

When prompted:

- Use existing `fly.toml` (app name `nomi-web-audit` unless you rename it)
- Do **not** add Postgres/Redis
- Adjust `primary_region` in `fly.toml` if needed (default `iad`)

### 3. Rotate and set secrets

**Important:** rotate `WEB_AUDIT_WORKER_SECRET` if an old value was ever committed or logged. The **same** secret must exist on **Fly** and **Supabase** or `/audit` and the callback will return `401`.

Generate a new secret (example):

```bash
openssl rand -hex 32
```

Set on Fly (replace values):

```bash
fly secrets set \
  WEB_AUDIT_WORKER_SECRET='YOUR_NEW_SECRET' \
  WEB_AUDIT_CALLBACK_URL='https://qjglkywmqwqdoaboakao.supabase.co/functions/v1/website_audit_callback' \
  WEB_AUDIT_TIMEOUT_MS='120000' \
  WEB_AUDIT_WORKER_ID='nomi-web-audit-fly'
```

Set the **matching** secret and worker URL on Supabase (hosted project):

```bash
# From repo root, with Supabase CLI linked:
supabase secrets set \
  WEB_AUDIT_WORKER_SECRET='YOUR_NEW_SECRET' \
  WEB_AUDIT_WORKER_URL='https://nomi-web-audit.fly.dev' \
  --project-ref qjglkywmqwqdoaboakao
```

Redeploy is **not** required for Supabase secrets (Edge picks them up). **Redeploy Fly** after changing Fly secrets if the app was already running.

### 4. Deploy

```bash
fly deploy
```

Verify:

```bash
fly status
curl -s https://nomi-web-audit.fly.dev/health
# → {"ok":true,"service":"web-audit-worker",...}
```

### 5. End-to-end test

In Nomi → Web Monitor → site profile → **Generar reporte**, or:

```bash
curl -X POST "https://qjglkywmqwqdoaboakao.supabase.co/functions/v1/website_audit_enqueue" \
  -H "Authorization: Bearer <user-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"monitored_website_id":150}'
```

Expect: audit `queued` → `running` → `done` (or `failed` with a clear message).

---

## Fly.io configuration (`fly.toml`)

| Setting | Value | Notes |
|---------|-------|--------|
| Memory | **1024 MB** | Bump to `2048mb` in `[[vm]]` if heavy sites OOM during Lighthouse |
| Scale to zero | `auto_stop_machines = "stop"`, `min_machines_running = 0` | No cost when idle |
| Health check | `GET /health` | 60s grace on deploy |
| Port | `8787` | Must match `PORT` env |

---

## Cold start (scale to zero)

Fly stops the machine when idle (`min_machines_running = 0`). **Enqueue uses wake-then-audit:**

1. Edge `website_audit_enqueue` sends **GET `/health`** (8s timeout, up to **2 attempts**) to wake the machine.
2. Only after `/health` returns 200 → **POST `/audit`** (45s timeout, returns 202).
3. If both health attempts fail → audit marked `failed` (*Worker no disponible*).

`/health` is **Node-only** (no Chromium). Chrome starts only inside `POST /audit` → `runAuditJob`.

Worst-case wake wait before push: ~16s (2×8s) + push — fits within typical Fly cold start without failing the first user click.

**Region:** hosted Supabase `qjglkywmqwqdoaboakao` is **us-east-1**; Fly **`iad`** (Virginia) minimizes worker ↔ Edge callback latency.

**Chrome in Docker/Fly:** `chrome-launcher.launch({ chromeFlags })` passes `--no-sandbox`, `--disable-setuid-sandbox`, and `--disable-dev-shm-usage` to the Chrome binary (see `src/chromeFlags.ts`). Lighthouse connects to that process by port — it does not relaunch Chrome.

If audits fail with cryptic Chrome errors on Fly, verify `CHROME_PATH=/usr/bin/chromium` in the image and bump VM memory to 2GB.

---

## Local development

```bash
cd workers/web-audit
npm install
export WEB_AUDIT_WORKER_SECRET=dev-secret
export WEB_AUDIT_CALLBACK_URL=https://<project-ref>.supabase.co/functions/v1/website_audit_callback
export WEB_AUDIT_TIMEOUT_MS=120000
npm run dev
```

Health: `curl http://localhost:8787/health`

Manual job:

```bash
curl -X POST http://localhost:8787/audit \
  -H "Authorization: Bearer dev-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "audit_id": 1,
    "org_id": 1,
    "monitored_website_id": 1,
    "url": "https://example.com",
    "strategy": "mobile",
    "callback_url": "https://<project-ref>.supabase.co/functions/v1/website_audit_callback"
  }'
```

Edge-case tests (hosted DB + Edge, worker local):

```bash
SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... \
  NODE_PATH=../../node_modules node scripts/run-edge-case-tests.mjs
```

---

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `WEB_AUDIT_WORKER_SECRET` | yes | — | Shared Bearer secret with Supabase Edge |
| `WEB_AUDIT_CALLBACK_URL` | no* | — | Default callback URL (*enqueue sends per-job URL*) |
| `WEB_AUDIT_TIMEOUT_MS` | no | `120000` | Max audit duration before `failed` |
| `WEB_AUDIT_CALLBACK_MAX_ATTEMPTS` | no | `6` | Callback retry count |
| `WEB_AUDIT_CALLBACK_INITIAL_DELAY_MS` | no | `1000` | Initial backoff delay |
| `WEB_AUDIT_WORKER_ID` | no | `web-audit-worker` | Stored on audit row |
| `PORT` | no | `8787` | HTTP port (Fly sets this) |
| `CHROME_PATH` | no | auto | Set to `/usr/bin/chromium` in Docker |
| `GOOGLE_CRUX_API_KEY` | no | — | Chrome UX Report API key (optional; CrUX skipped if unset) |
| `WEB_AUDIT_USER_AGENT` | no | Chrome desktop UA | Static fetch UA |

**Supabase Edge** (enqueue) also needs:

| Variable | Description |
|----------|-------------|
| `WEB_AUDIT_WORKER_URL` | Base URL of this worker, no trailing slash (e.g. `https://nomi-web-audit.fly.dev`) |
| `WEB_AUDIT_WORKER_SECRET` | **Must match** Fly secret exactly |

---

## Failure modes

| Case | Worker behavior |
|------|-----------------|
| Timeout (> `WEB_AUDIT_TIMEOUT_MS`) | `failed` callback with retries; `finally` sends `failed` if still no terminal ack |
| Bot protection / connection reset | `failed` with bot-specific message |
| Callback unreachable | Retries with backoff; `finally` block last-resort `failed` |
| Fly cold start / push timeout | Enqueue marks `failed` with *Worker no disponible*; retry enqueue (machine warm) |

## Orphan safety (DB)

```sql
select public.fail_stale_website_audits(150);
```

See `supabase/migrations/20260711130000_website_audit_stale_sweep.sql` and `20260711140000_website_audit_stale_cron.sql` (pg_cron every 5 min).

If PUSH from Edge fails (worker down), enqueue marks the audit `failed` immediately so the site is not blocked.
