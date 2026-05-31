import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { isAuthorizedFollowUpCron } from "../_shared/notifyFollowUp.ts";
import {
  enqueueWebsiteAudit,
  retryQueuedAuditPush,
} from "../_shared/websiteAuditWorker.ts";
import { getWebsiteMonitorSettings } from "../_shared/websiteMonitorSettings.ts";

type ScheduleMode = "retry" | "due" | "all";

const RETRY_BATCH = 3;
const SCHEDULE_BATCH = 2;
const RETRY_MIN_AGE_MS = 5 * 60 * 1000;
const MAX_PUSH_ATTEMPTS = 5;

const parseMode = (raw: unknown): ScheduleMode => {
  if (raw === "retry" || raw === "due" || raw === "all") return raw;
  return "all";
};

const daysSince = (iso: string | null | undefined) => {
  if (!iso) return Number.POSITIVE_INFINITY;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return Number.POSITIVE_INFINITY;
  return ms / (24 * 60 * 60 * 1000);
};

Deno.serve((req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    if (!isAuthorizedFollowUpCron(req)) {
      return createErrorResponse(401, "Unauthorized");
    }

    let mode: ScheduleMode = "all";
    try {
      const body = (await req.json()) as { mode?: unknown };
      mode = parseMode(body?.mode);
    } catch {
      mode = "all";
    }

    const { supabaseAdmin } = await import("../_shared/supabaseAdmin.ts");
    const orgSettingsCache = new Map<
      number,
      Awaited<ReturnType<typeof getWebsiteMonitorSettings>>
    >();

    const isOrgEnabled = async (orgId: number) => {
      if (!orgSettingsCache.has(orgId)) {
        orgSettingsCache.set(
          orgId,
          await getWebsiteMonitorSettings(supabaseAdmin, orgId),
        );
      }
      return orgSettingsCache.get(orgId)?.enabled !== false;
    };

    let retried = 0;
    let retryFailures = 0;
    let scheduled = 0;
    let scheduleSkipped = 0;

    if (mode === "retry" || mode === "all") {
      const retryCutoff = new Date(Date.now() - RETRY_MIN_AGE_MS).toISOString();
      const { data: queued, error: queuedError } = await supabaseAdmin
        .from("website_audits")
        .select(
          "id, org_id, monitored_website_id, audit_url, worker_push_attempts, last_worker_push_at, started_at",
        )
        .eq("status", "queued")
        .is("started_at", null)
        .lt("worker_push_attempts", MAX_PUSH_ATTEMPTS)
        .or(`last_worker_push_at.is.null,last_worker_push_at.lt.${retryCutoff}`)
        .order("requested_at", { ascending: true })
        .limit(RETRY_BATCH);

      if (queuedError) {
        return createErrorResponse(500, queuedError.message);
      }

      for (const audit of queued ?? []) {
        if (!(await isOrgEnabled(audit.org_id))) continue;
        const result = await retryQueuedAuditPush(supabaseAdmin, audit);
        if (result.pushed) {
          retried += 1;
        } else {
          retryFailures += 1;
        }
      }
    }

    if (mode === "due" || mode === "all") {
      const { data: sites, error: sitesError } = await supabaseAdmin
        .from("monitored_websites")
        .select(
          "id, org_id, url, display_name, audit_schedule_enabled, audit_interval_days, is_enabled",
        )
        .eq("is_enabled", true)
        .eq("audit_schedule_enabled", true)
        .order("updated_at", { ascending: true })
        .limit(50);

      if (sitesError) {
        return createErrorResponse(500, sitesError.message);
      }

      const dueSites = [];
      for (const site of sites ?? []) {
        if (!(await isOrgEnabled(site.org_id))) continue;

        const { data: lastDone } = await supabaseAdmin
          .from("website_audits")
          .select("requested_at")
          .eq("monitored_website_id", site.id)
          .eq("status", "done")
          .order("requested_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const intervalDays = site.audit_interval_days ?? 30;
        if (daysSince(lastDone?.requested_at ?? null) >= intervalDays) {
          dueSites.push(site);
        }
      }

      for (const site of dueSites.slice(0, SCHEDULE_BATCH)) {
        try {
          const result = await enqueueWebsiteAudit(supabaseAdmin, {
            orgId: site.org_id,
            siteId: site.id,
            siteUrl: site.url,
            scheduled: true,
          });
          if (result.reused) {
            scheduleSkipped += 1;
          } else {
            scheduled += 1;
          }
        } catch {
          scheduleSkipped += 1;
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        mode,
        retried,
        retry_failures: retryFailures,
        scheduled,
        schedule_skipped: scheduleSkipped,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }),
);
