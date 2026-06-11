# Web Monitor

## 1. Purpose

Monitor client websites for uptime, content/stack changes, and scheduled Lighthouse + axe audits (“Web Report”). Google Search Console integration for analytics snapshots.

## 2. Files & components

| Kind | Path |
|------|------|
| Routes | `/web-monitor`, `/web-monitor/:id/show`, `/web-monitor/:id/audit/:auditId` |
| Module | `src/lbs/website-monitor/` (~73 files) |
| Settings | `WebsiteMonitorSettingsSection.tsx`, `useWebsiteMonitorSettings.ts` |
| Worker | `workers/web-audit/` |
| Bootstrap | `websiteMonitorBootstrap.ts` (daily sync on load) |

Nav hidden when `organizations.website_monitor_settings.enabled === false`.

## 3. Database

| Table / view | Usage |
|--------------|--------|
| `monitored_websites`, `monitored_websites_summary` | List/show (summary view via dataProvider redirect) |
| `website_audits`, `website_monitor_changes`, `website_monitor_checks` | Audits and change history |
| `gsc_search_analytics_snapshots` | GSC data |
| Org JSON | `organizations.website_monitor_settings` |

## 4. External services

| Service | Role |
|---------|------|
| **Web audit worker** | Lighthouse + axe; callbacks to Supabase |
| **Google CrUX API** | Optional performance data |
| **Google Search Console** | OAuth + sync via `google_gsc/*` edge routes |
| **Email** | Audit report send via `website_audit_send` |

### Cloud Run vs Fly.io (traffic & decommission)

| Deployment | Path / docs | Notes |
|------------|-------------|-------|
| **Cloud Run (primary)** | `workers/web-audit/CLOUD_RUN.md`, `scripts/deploy-cloud-run.sh` | Documented production target; region `us-east1`; 4Gi / 900s timeout |
| **Fly.io (legacy)** | `workers/web-audit/fly.toml` — app `nomi-web-audit` | Rollback only; `fly scale count 0` when Cloud Run stable |

**Which worker receives traffic:** Supabase edge `website_audit_enqueue` / `website_audit_schedule` call `pushAuditJobToWorker()` in `supabase/functions/_shared/websiteAuditWorker.ts`, posting to:

```
POST {WEB_AUDIT_WORKER_URL}/audit
Authorization: Bearer {WEB_AUDIT_WORKER_SECRET}
```

Secrets are **hosted-only** — not in repo. **Cannot verify live URL from codebase.**

**Ops checklist to confirm traffic:**

1. Supabase Dashboard → Edge Functions → Secrets → read `WEB_AUDIT_WORKER_URL`.
2. If URL contains `.run.app` → Cloud Run is primary; check Cloud Run metrics for `/audit` requests.
3. If URL contains `fly.dev` → still on legacy Fly.
4. Fly dashboard: if zero requests for 30+ days after Cloud Run cutover → **decommission Fly** (`fly scale count 0 -a nomi-web-audit` per `CLOUD_RUN.md`).

E2E scripts default to `https://nomi-web-audit.fly.dev` — legacy fallback reference only.

## 5. Connections to other modules

| Direction | Module | Link |
|-----------|--------|------|
| Links to | Companies | Monitored site per company |
| Settings | Web Monitor tab | Enable/disable, defaults |
| Settings | GSC | OAuth in `google_gsc/*` |

## 6. Edge functions used by this module

| Function | Invoked from | Trigger |
|----------|--------------|---------|
| `website_monitor_sync` | `dataProvider.websiteMonitorSync()` | Manual / bootstrap |
| `website_monitor_check` | `dataProvider.websiteMonitorCheck()` | Manual |
| `website_monitor_run_org` | `dataProvider.websiteMonitorRunOrg()` | Manual |
| `website_monitor_create` | `dataProvider.websiteMonitorCreate()` | Create site |
| `website_monitor_run` | **pg_cron** `website_monitor_run_every_5m` | Every 5 min |
| `website_audit_enqueue` | `dataProvider` manual audit | User-triggered report |
| `website_audit_schedule` | **pg_cron** retry + daily due | See pg_cron table in `00-OVERVIEW.md` |
| `website_audit_callback` | **Webhook** from worker | Audit completion |
| `website_audit_send` | `dataProvider` | Email report |
| `website_audit_summarize` | `dataProvider` | AI summary |
| `google_gsc/status`, `start-oauth`, `disconnect`, `sync` | GSC panels | OAuth lifecycle |

**pg_cron SQL-only job:** `fail_stale_website_audits` — marks stale rows failed (no edge function).

## 7. Status: WORKING

Feature-rich when worker secrets and vault cron secrets (`website_monitor_project_url`, `website_monitor_cron_secret`) are set.

## 8. Issues found

| Severity | Location | User impact | Root cause |
|----------|----------|-------------|------------|
| MEDIUM | `MonitoredWebsitesList` filters | Spanish UI strings | Violates English UI rule (“Todos”, “Buscar…”) |
| MEDIUM | Permissions | All members can access | `monitored_websites` not in permission catalog; nav uses `crm.companies.view` |
| LOW | Worker errors | Spanish edge messages | `websiteAuditWorker.ts`: “Worker no disponible” |
| LOW | Repo vs live DB | Stale audit timeout drift | Migration `fail_stale_website_audits_5m` **not** in live `cron.job` — **queue migration deploy** in fix phase |

## 9. Broken connections

- Worker URL must match deployed Cloud Run service — misconfigured secret → audits queue but never complete.
- GSC requires OAuth per org; disconnected state shows empty panels (expected).
