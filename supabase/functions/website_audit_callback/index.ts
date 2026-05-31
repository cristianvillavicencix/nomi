import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { verifyWebsiteAuditWorkerSecret } from "../_shared/websiteAuditAuth.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { triggerWebsiteAuditSummarize } from "../_shared/websiteAuditAiSummary.ts";
import { notifyWebsiteAuditScoreDrop } from "../_shared/notifyWebsiteAuditScoreDrop.ts";
import { triggerGoogleGscSync } from "../_shared/googleSearchConsole.ts";
import {
  sanitizeAuditFindingInput,
  sanitizeForPostgresJson,
} from "../_shared/sanitizeForPostgresJson.ts";
import type {
  AuditFindingInput,
  WebsiteAuditCallbackPayload,
  WebsiteAuditStatus,
} from "../_shared/websiteAuditTypes.ts";

const TERMINAL_STATUSES = new Set<WebsiteAuditStatus>(["done", "failed"]);

const isTerminal = (status: string) =>
  TERMINAL_STATUSES.has(status as WebsiteAuditStatus);

Deno.serve((req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    const authError = verifyWebsiteAuditWorkerSecret(req);
    if (authError) return authError;

    let payload: WebsiteAuditCallbackPayload;
    try {
      payload = (await req.json()) as WebsiteAuditCallbackPayload;
    } catch {
      return createErrorResponse(400, "Invalid JSON body");
    }

    const auditId = Number(payload.audit_id);
    if (!Number.isFinite(auditId) || auditId <= 0) {
      return createErrorResponse(400, "audit_id is required");
    }

    const nextStatus = payload.status;
    if (
      !nextStatus ||
      !["queued", "running", "done", "failed"].includes(nextStatus)
    ) {
      return createErrorResponse(400, "Invalid status");
    }

    const { data: current, error: fetchError } = await supabaseAdmin
      .from("website_audits")
      .select("id, org_id, status, monitored_website_id")
      .eq("id", auditId)
      .maybeSingle();

    if (fetchError) {
      return createErrorResponse(500, fetchError.message);
    }
    if (!current) {
      return createErrorResponse(404, "Audit not found");
    }

    // Idempotent: terminal state already applied — ack without touching findings.
    // Retry after a successful done: status is already done/failed → no second insert.
    if (isTerminal(current.status)) {
      return new Response(
        JSON.stringify({
          ok: true,
          idempotent: true,
          audit_id: auditId,
          status: current.status,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (nextStatus === "running") {
      if (current.status !== "queued" && current.status !== "running") {
        return new Response(
          JSON.stringify({
            ok: true,
            idempotent: true,
            audit_id: auditId,
            status: current.status,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { error: runningError } = await supabaseAdmin
        .from("website_audits")
        .update({
          status: "running",
          started_at: new Date().toISOString(),
          worker_id: payload.worker_id ?? null,
          progress_phase: payload.progress_phase ?? null,
        })
        .eq("id", auditId)
        .in("status", ["queued", "running"]);

      if (runningError) {
        return createErrorResponse(500, runningError.message);
      }

      return new Response(
        JSON.stringify({ ok: true, audit_id: auditId, status: "running" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!isTerminal(nextStatus)) {
      return createErrorResponse(400, "Callback must set running, done, or failed");
    }

    const now = new Date().toISOString();
    const auditPatch: Record<string, unknown> = {
      status: nextStatus,
      completed_at: now,
      worker_id: payload.worker_id ?? null,
      error_message:
        payload.error_message == null
          ? null
          : String(sanitizeForPostgresJson(payload.error_message)),
      ...(payload.strategy ? { strategy: payload.strategy } : {}),
      overall_score: payload.overall_score ?? null,
      score_performance: payload.score_performance ?? null,
      score_seo: payload.score_seo ?? null,
      score_best_practices: payload.score_best_practices ?? null,
      score_accessibility: payload.score_accessibility ?? null,
      lab_lcp_ms: payload.lab_lcp_ms ?? null,
      lab_cls: payload.lab_cls ?? null,
      lab_tbt_ms: payload.lab_tbt_ms ?? null,
      field_lcp_ms: payload.field_lcp_ms ?? null,
      field_cls: payload.field_cls ?? null,
      field_inp_ms: payload.field_inp_ms ?? null,
      crux_has_data: payload.crux_has_data ?? false,
      static_json: sanitizeForPostgresJson(payload.static_json ?? {}),
      lighthouse_json: payload.lighthouse_json
        ? sanitizeForPostgresJson(payload.lighthouse_json)
        : null,
      axe_json: payload.axe_json
        ? sanitizeForPostgresJson(payload.axe_json)
        : null,
      crux_json: payload.crux_json
        ? sanitizeForPostgresJson(payload.crux_json)
        : null,
      mobile_snapshot: payload.mobile_snapshot
        ? sanitizeForPostgresJson(payload.mobile_snapshot)
        : null,
      desktop_snapshot: payload.desktop_snapshot
        ? sanitizeForPostgresJson(payload.desktop_snapshot)
        : null,
      pdf_storage_path: payload.pdf_storage_path ?? null,
      ...(nextStatus === "done"
        ? { ai_summary_status: "pending" as const }
        : {}),
    };

    const { data: updatedRows, error: updateError } = await supabaseAdmin
      .from("website_audits")
      .update(auditPatch)
      .eq("id", auditId)
      .in("status", ["queued", "running"])
      .select("id");

    if (updateError) {
      return createErrorResponse(500, updateError.message);
    }

    if (!updatedRows?.length) {
      const { data: latest } = await supabaseAdmin
        .from("website_audits")
        .select("status")
        .eq("id", auditId)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          ok: true,
          idempotent: true,
          audit_id: auditId,
          status: latest?.status ?? current.status,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (nextStatus === "done" && Array.isArray(payload.findings)) {
      // Replace findings atomically for this transition (never blind append).
      // Safe on worker retry: if status is already done, we returned idempotent above.
      const { error: deleteError } = await supabaseAdmin
        .from("audit_findings")
        .delete()
        .eq("audit_id", auditId);

      if (deleteError) {
        return createErrorResponse(500, deleteError.message);
      }

      const findings = payload.findings as AuditFindingInput[];
      if (findings.length > 0) {
        const { error: findingsError } = await supabaseAdmin
          .from("audit_findings")
          .insert(
            findings.map((finding, index) => {
              const clean = sanitizeAuditFindingInput(
                finding as unknown as Record<string, unknown>,
              );
              return {
                org_id: current.org_id,
                audit_id: auditId,
                category: finding.category,
                severity: finding.severity,
                source: finding.source,
                source_id: finding.source_id ?? null,
                title: clean.title as string,
                description: clean.description as string | null,
                recommendation: clean.recommendation as string | null,
                commercial_message: clean.commercial_message as string | null,
                metric_key: finding.metric_key ?? null,
                metric_value: clean.metric_value as string | null,
                display_order: finding.display_order ?? index,
              };
            }),
          );

        if (findingsError) {
          return createErrorResponse(500, findingsError.message);
        }
      }

      triggerWebsiteAuditSummarize(auditId);

      if (current.monitored_website_id != null) {
        triggerGoogleGscSync({
          orgId: current.org_id,
          monitoredWebsiteId: Number(current.monitored_website_id),
        });
      }

      if (
        payload.overall_score != null &&
        current.monitored_website_id != null
      ) {
        const siteId = Number(current.monitored_website_id);
        const { data: site } = await supabaseAdmin
          .from("monitored_websites")
          .select(
            "id, org_id, url, display_name, audit_alert_on_score_drop, audit_score_drop_threshold, last_audit_score_alert_at",
          )
          .eq("id", siteId)
          .maybeSingle();

        const { data: previousDone } = await supabaseAdmin
          .from("website_audits")
          .select("overall_score")
          .eq("monitored_website_id", siteId)
          .eq("status", "done")
          .neq("id", auditId)
          .order("requested_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (
          site &&
          previousDone?.overall_score != null &&
          payload.overall_score < previousDone.overall_score
        ) {
          notifyWebsiteAuditScoreDrop(
            supabaseAdmin,
            site,
            payload.overall_score,
            previousDone.overall_score,
          ).catch((err) =>
            console.error("notifyWebsiteAuditScoreDrop", auditId, err),
          );
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, audit_id: auditId, status: nextStatus }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }),
);
