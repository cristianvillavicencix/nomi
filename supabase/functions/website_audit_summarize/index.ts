import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { UserMiddleware } from "../_shared/authentication.ts";
import { createErrorResponse } from "../_shared/utils.ts";
import { getUserOrganizationMember } from "../_shared/getUserOrganizationMember.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import {
  getWebsiteAuditWorkerSecret,
} from "../_shared/websiteAuditAuth.ts";
import {
  buildAuditContextForAi,
  generateWebsiteAuditAiSummary,
} from "../_shared/websiteAuditAiSummary.ts";
import type { AuditFindingInput } from "../_shared/websiteAuditTypes.ts";
import type { User } from "jsr:@supabase/supabase-js@2";

type SummarizeBody = {
  audit_id?: number;
  force?: boolean;
};

const isWorkerAuthorized = (req: Request) => {
  const expected = getWebsiteAuditWorkerSecret();
  if (!expected) return false;
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";
  return Boolean(token && token === expected);
};

const runSummarize = async (req: Request, user?: User) => {
  let payload: SummarizeBody;
  try {
    payload = (await req.json()) as SummarizeBody;
  } catch {
    return createErrorResponse(400, "Invalid JSON body");
  }

  const auditId = Number(payload.audit_id);
  const force = Boolean(payload.force);
  if (!Number.isFinite(auditId) || auditId <= 0) {
    return createErrorResponse(400, "audit_id is required");
  }

  const { data: audit, error: auditError } = await supabaseAdmin
    .from("website_audits")
    .select(
      "id, org_id, status, audit_url, overall_score, score_performance, score_seo, score_best_practices, score_accessibility, lab_lcp_ms, lab_cls, lab_tbt_ms, field_lcp_ms, field_cls, field_inp_ms, crux_has_data, static_json, mobile_snapshot, desktop_snapshot, ai_summary_status, monitored_website_id",
    )
    .eq("id", auditId)
    .maybeSingle();

  if (auditError) {
    return createErrorResponse(500, auditError.message);
  }
  if (!audit) {
    return createErrorResponse(404, "Audit not found");
  }
  if (audit.status !== "done") {
    return createErrorResponse(400, "Audit must be completed before summarizing");
  }

  if (user) {
    const member = await getUserOrganizationMember(user);
    const orgId = member?.org_id != null ? Number(member.org_id) : null;
    if (!orgId || Number(audit.org_id) !== orgId) {
      return createErrorResponse(403, "Forbidden");
    }
  }

  const currentStatus = audit.ai_summary_status as string | null;
  if (
    !force &&
    (currentStatus === "running" || currentStatus === "done")
  ) {
    return new Response(
      JSON.stringify({
        ok: true,
        idempotent: true,
        audit_id: auditId,
        ai_summary_status: currentStatus,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!Deno.env.get("ANTHROPIC_API_KEY")?.trim()) {
    const { error: skipError } = await supabaseAdmin
      .from("website_audits")
      .update({
        ai_summary_status: "skipped",
        ai_summary_error: "ANTHROPIC_API_KEY is not configured",
        ai_summary_json: null,
        ai_summary_generated_at: null,
      })
      .eq("id", auditId);

    if (skipError) {
      return createErrorResponse(500, skipError.message);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        audit_id: auditId,
        ai_summary_status: "skipped",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const { error: runningError } = await supabaseAdmin
    .from("website_audits")
    .update({
      ai_summary_status: "running",
      ai_summary_error: null,
    })
    .eq("id", auditId);

  if (runningError) {
    return createErrorResponse(500, runningError.message);
  }

  try {
    const { data: findingsRows, error: findingsError } = await supabaseAdmin
      .from("audit_findings")
      .select(
        "category, severity, source, source_id, title, description, recommendation, metric_key, metric_value, display_order",
      )
      .eq("audit_id", auditId)
      .order("display_order", { ascending: true });

    if (findingsError) {
      throw new Error(findingsError.message);
    }

    const { data: site } = await supabaseAdmin
      .from("monitored_websites")
      .select("display_name, url")
      .eq("id", audit.monitored_website_id)
      .maybeSingle();

    const siteLabel =
      site?.display_name?.trim() || site?.url?.trim() || audit.audit_url;

    const context = buildAuditContextForAi({
      audit,
      siteLabel,
      findings: (findingsRows ?? []) as AuditFindingInput[],
    });

    const summary = await generateWebsiteAuditAiSummary(context);
    const now = new Date().toISOString();

    const { error: doneError } = await supabaseAdmin
      .from("website_audits")
      .update({
        ai_summary_status: "done",
        ai_summary_json: summary,
        ai_summary_error: null,
        ai_summary_generated_at: now,
      })
      .eq("id", auditId);

    if (doneError) {
      throw new Error(doneError.message);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        audit_id: auditId,
        ai_summary_status: "done",
        ai_summary_generated_at: now,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error("website_audit_summarize", message);

    await supabaseAdmin
      .from("website_audits")
      .update({
        ai_summary_status: "failed",
        ai_summary_error: message.slice(0, 2000),
      })
      .eq("id", auditId);

    return createErrorResponse(500, message);
  }
};

Deno.serve((req: Request) =>
  OptionsMiddleware(req, async (req) => {
    if (req.method !== "POST") {
      return createErrorResponse(405, "Method not allowed");
    }

    if (isWorkerAuthorized(req)) {
      return runSummarize(req);
    }

    return UserMiddleware(req, async (req, user) => {
      if (!user) {
        return createErrorResponse(401, "Unauthorized");
      }
      return runSummarize(req, user);
    });
  }),
);
