import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import {
  getWebsiteAuditCallbackUrl,
  getWebsiteAuditWorkerSecret,
  getWebsiteAuditWorkerUrl,
} from "../_shared/websiteAuditAuth.ts";
import type { WebsiteAuditWorkerJob } from "../_shared/websiteAuditTypes.ts";

const ACTIVE_STATUSES = ["queued", "running"] as const;
/** GET /health per attempt — wakes Fly machine without starting Chrome. */
const WORKER_HEALTH_TIMEOUT_MS = 8_000;
const WORKER_HEALTH_MAX_ATTEMPTS = 2;
/** POST /audit after worker is awake (202 only, not full Lighthouse run). */
const WORKER_PUSH_TIMEOUT_MS = 45_000;
const WORKER_UNAVAILABLE = "Worker no disponible";

const normalizeWorkerBaseUrl = (workerUrl: string) =>
  workerUrl.trim().replace(/\/$/, "");

/** Wake scale-to-zero worker before enqueueing audit (cheap GET, no Chrome). */
const wakeWorker = async (workerUrl: string): Promise<void> => {
  const healthUrl = `${normalizeWorkerBaseUrl(workerUrl)}/health`;
  let lastError = "sin respuesta";

  for (
    let attempt = 1;
    attempt <= WORKER_HEALTH_MAX_ATTEMPTS;
    attempt += 1
  ) {
    try {
      const response = await fetch(healthUrl, {
        method: "GET",
        signal: AbortSignal.timeout(WORKER_HEALTH_TIMEOUT_MS),
      });
      if (response.ok) {
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (cause) {
      lastError = cause instanceof Error ? cause.message : String(cause);
    }
  }

  throw new Error(
    `${WORKER_UNAVAILABLE}: el worker no respondió a /health tras ${WORKER_HEALTH_MAX_ATTEMPTS} intentos (${lastError})`,
  );
};

const markAuditFailed = async (
  supabaseAdmin: { from: (table: string) => unknown },
  auditId: number,
  errorMessage: string,
) => {
  await (supabaseAdmin.from("website_audits") as {
    update: (values: Record<string, unknown>) => {
      eq: (col: string, val: number) => {
        in: (col: string, vals: string[]) => Promise<unknown>;
      };
    };
  })
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: errorMessage,
    })
    .eq("id", auditId)
    .in("status", [...ACTIVE_STATUSES]);
};

const pushAuditToWorker = async (job: WebsiteAuditWorkerJob) => {
  const workerUrl = getWebsiteAuditWorkerUrl();
  const secret = getWebsiteAuditWorkerSecret();

  if (!workerUrl || !secret) {
    throw new Error(
      `${WORKER_UNAVAILABLE}: WEB_AUDIT_WORKER_URL o WEB_AUDIT_WORKER_SECRET no configurados.`,
    );
  }

  const baseUrl = normalizeWorkerBaseUrl(workerUrl);
  await wakeWorker(baseUrl);

  const response = await fetch(`${baseUrl}/audit`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(job),
    signal: AbortSignal.timeout(WORKER_PUSH_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `${WORKER_UNAVAILABLE} (HTTP ${response.status}): ${body.slice(0, 200)}`,
    );
  }

  return { pushed: true as const };
};

Deno.serve((req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    return UserMiddleware(req, async (_req, user) => {
      if (!user) {
        return createErrorResponse(401, "Unauthorized");
      }

      const member = await getUserOrganizationMember(user);
      if (!member?.org_id) {
        return createErrorResponse(403, "Forbidden");
      }

      let payload: { monitored_website_id?: number; strategy?: string };
      try {
        payload = (await req.json()) as typeof payload;
      } catch {
        return createErrorResponse(400, "Invalid JSON body");
      }

      const siteId = Number(payload.monitored_website_id);
      if (!Number.isFinite(siteId) || siteId <= 0) {
        return createErrorResponse(400, "monitored_website_id is required");
      }

      const strategy = "unified" as const;

      const { data: site, error: siteError } = await supabaseAdmin
        .from("monitored_websites")
        .select("id, org_id, url, is_enabled")
        .eq("id", siteId)
        .eq("org_id", member.org_id)
        .maybeSingle();

      if (siteError) {
        return createErrorResponse(500, siteError.message);
      }
      if (!site) {
        return createErrorResponse(404, "Website not found");
      }

      const { data: existingActive, error: activeError } = await supabaseAdmin
        .from("website_audits")
        .select("*")
        .eq("monitored_website_id", siteId)
        .in("status", [...ACTIVE_STATUSES])
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeError) {
        return createErrorResponse(500, activeError.message);
      }

      if (existingActive) {
        return new Response(
          JSON.stringify({
            ok: true,
            reused: true,
            audit: existingActive,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const callbackUrl = getWebsiteAuditCallbackUrl();
      if (!callbackUrl) {
        return createErrorResponse(
          503,
          "WEB_AUDIT_CALLBACK_URL or SUPABASE_URL is not configured",
        );
      }

      const { data: created, error: insertError } = await supabaseAdmin
        .from("website_audits")
        .insert({
          org_id: member.org_id,
          monitored_website_id: siteId,
          requested_by_member_id: member.id,
          status: "queued",
          audit_url: site.url,
          strategy,
        })
        .select("*")
        .single();

      if (insertError) {
        if (insertError.code === "23505") {
          const { data: raced } = await supabaseAdmin
            .from("website_audits")
            .select("*")
            .eq("monitored_website_id", siteId)
            .in("status", [...ACTIVE_STATUSES])
            .order("requested_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (raced) {
            return new Response(
              JSON.stringify({ ok: true, reused: true, audit: raced }),
              {
                headers: {
                  ...corsHeaders,
                  "Content-Type": "application/json",
                },
              },
            );
          }
        }
        return createErrorResponse(500, insertError.message);
      }

      const job: WebsiteAuditWorkerJob = {
        audit_id: created.id,
        org_id: member.org_id,
        monitored_website_id: siteId,
        url: site.url,
        strategy,
        callback_url: callbackUrl,
      };

      try {
        const pushResult = await pushAuditToWorker(job);
        return new Response(
          JSON.stringify({
            ok: true,
            reused: false,
            audit: created,
            worker: pushResult,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (cause) {
        const rawMessage =
          cause instanceof Error ? cause.message : "Worker push failed";
        const errorMessage = rawMessage.startsWith(WORKER_UNAVAILABLE)
          ? rawMessage
          : `${WORKER_UNAVAILABLE}: ${rawMessage}`;

        await markAuditFailed(supabaseAdmin, created.id, errorMessage);

        const { data: failedAudit } = await supabaseAdmin
          .from("website_audits")
          .select("*")
          .eq("id", created.id)
          .maybeSingle();

        return new Response(
          JSON.stringify({
            ok: true,
            reused: false,
            audit: failedAudit ?? { ...created, status: "failed", error_message: errorMessage },
            worker: { pushed: false, error: errorMessage },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    });
  }),
);
