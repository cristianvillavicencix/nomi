import type { Identifier } from "ra-core";
import {
  invokeEdgeFunction,
  readEdgeFunctionErrorMessage,
} from "../invokeEdgeFunction";

export const webMonitorProvider = {
  async websiteMonitorSync() {
    const { data, error } = await invokeEdgeFunction<{ synced?: number }>(
      "website_monitor_sync",
      { method: "POST", body: {} },
    );
    if (error) {
      throw new Error(
        await readEdgeFunctionErrorMessage(error, "Failed to sync websites"),
      );
    }
    return data ?? { ok: true, synced: 0 };
  },
  async websiteMonitorCheck(params: {
    monitoredWebsiteId: Identifier;
    includeDeepMetadata?: boolean;
  }) {
    const { data, error } = await invokeEdgeFunction<{
      ok?: boolean;
      status?: string;
      responseMs?: number | null;
      httpStatus?: number | null;
      errorMessage?: string | null;
    }>("website_monitor_check", {
      method: "POST",
      body: {
        monitored_website_id: Number(params.monitoredWebsiteId),
        include_deep_metadata: params.includeDeepMetadata ?? true,
      },
    });
    if (error) {
      throw new Error(
        await readEdgeFunctionErrorMessage(error, "Failed to check website"),
      );
    }
    return data ?? { ok: true };
  },
  async websiteMonitorRunOrg(params?: {
    forceAll?: boolean;
    maxBatch?: number;
  }) {
    const { data, error } = await invokeEdgeFunction<{
      ok?: boolean;
      checked?: number;
      failures?: number;
      due?: number;
    }>("website_monitor_run_org", {
      method: "POST",
      body: {
        force_all: params?.forceAll ?? false,
        max_batch: params?.maxBatch ?? 3,
      },
    });
    if (error) {
      throw new Error(
        await readEdgeFunctionErrorMessage(
          error,
          "Failed to run website checks",
        ),
      );
    }
    return data ?? { ok: true, checked: 0, failures: 0, due: 0 };
  },
  async websiteMonitorCreate(params: {
    url: string;
    displayName?: string;
    notes?: string;
    companyId?: Identifier;
    dealId?: Identifier;
    checkPaths?: string[];
  }) {
    const { data, error } = await invokeEdgeFunction<{
      ok?: boolean;
      id?: number;
    }>("website_monitor_create", {
      method: "POST",
      body: {
        url: params.url,
        display_name: params.displayName,
        notes: params.notes,
        company_id: params.companyId != null ? Number(params.companyId) : null,
        deal_id: params.dealId != null ? Number(params.dealId) : null,
        check_paths: params.checkPaths,
      },
    });
    if (error) {
      throw new Error(
        await readEdgeFunctionErrorMessage(error, "Failed to add website"),
      );
    }
    return data ?? { ok: true };
  },
  async websiteAuditEnqueue(params: {
    monitoredWebsiteId: Identifier;
    strategy?: "mobile" | "desktop";
  }) {
    const { data, error } = await invokeEdgeFunction<{
      ok?: boolean;
      reused?: boolean;
      audit?: Record<string, unknown>;
      worker?: { pushed?: boolean; error?: string };
    }>("website_audit_enqueue", {
      method: "POST",
      body: {
        monitored_website_id: Number(params.monitoredWebsiteId),
        strategy: params.strategy ?? "mobile",
      },
    });
    if (error) {
      throw new Error(
        await readEdgeFunctionErrorMessage(
          error,
          "Failed to enqueue website audit",
        ),
      );
    }
    if (!data?.audit) {
      throw new Error("Invalid audit enqueue response");
    }
    return {
      ok: Boolean(data.ok),
      reused: Boolean(data.reused),
      audit: data.audit,
      worker: data.worker,
    };
  },
  async websiteAuditSend(params: {
    auditId: number;
    to: string;
    subject: string;
    message: string;
    pdfBase64: string;
    filename?: string;
  }) {
    const { data, error } = await invokeEdgeFunction<{ ok?: boolean }>(
      "website_audit_send",
      {
        method: "POST",
        body: {
          audit_id: params.auditId,
          to: params.to,
          subject: params.subject,
          message: params.message,
          pdf_base64: params.pdfBase64,
          filename: params.filename,
        },
      },
    );
    if (error) {
      throw new Error(
        await readEdgeFunctionErrorMessage(
          error,
          "Failed to send website audit report",
        ),
      );
    }
    return { ok: Boolean(data?.ok) };
  },
  async websiteAuditSummarize(params: { auditId: number; force?: boolean }) {
    const { data, error } = await invokeEdgeFunction<{
      ok?: boolean;
      audit_id?: number;
      ai_summary_status?: string;
      ai_summary_generated_at?: string;
    }>("website_audit_summarize", {
      method: "POST",
      body: {
        audit_id: params.auditId,
        force: params.force ?? false,
      },
    });
    if (error) {
      throw new Error(
        await readEdgeFunctionErrorMessage(
          error,
          "Failed to generate AI audit summary",
        ),
      );
    }
    return {
      ok: Boolean(data?.ok),
      aiSummaryStatus: data?.ai_summary_status,
      aiSummaryGeneratedAt: data?.ai_summary_generated_at,
    };
  },
  async googleGscStatus() {
    const { data, error } = await invokeEdgeFunction<{
      ok?: boolean;
      connected?: boolean;
      google_email?: string | null;
      last_synced_at?: string | null;
      snapshot_count?: number;
    }>("google_gsc/status", { method: "GET" });
    if (error) {
      throw new Error(
        await readEdgeFunctionErrorMessage(
          error,
          "Failed to load Search Console status",
        ),
      );
    }
    return {
      ok: Boolean(data?.ok),
      connected: Boolean(data?.connected),
      google_email: data?.google_email ?? null,
      last_synced_at: data?.last_synced_at ?? null,
      snapshot_count: data?.snapshot_count ?? 0,
    };
  },
  async googleGscConnect(params?: { redirectAfter?: string }) {
    const { data, error } = await invokeEdgeFunction<{
      ok?: boolean;
      authorize_url?: string;
    }>("google_gsc/start-oauth", {
      method: "POST",
      body: { redirect_after: params?.redirectAfter },
    });
    if (error) {
      throw new Error(
        await readEdgeFunctionErrorMessage(
          error,
          "Failed to start Search Console OAuth",
        ),
      );
    }
    if (!data?.authorize_url) {
      throw new Error("Invalid OAuth response");
    }
    return { ok: true, authorize_url: data.authorize_url };
  },
  async googleGscDisconnect() {
    const { data, error } = await invokeEdgeFunction<{ ok?: boolean }>(
      "google_gsc/disconnect",
      { method: "POST", body: {} },
    );
    if (error) {
      throw new Error(
        await readEdgeFunctionErrorMessage(
          error,
          "Failed to disconnect Search Console",
        ),
      );
    }
    return { ok: Boolean(data?.ok) };
  },
  async googleGscSync(params: {
    monitoredWebsiteId?: Identifier;
    syncAll?: boolean;
  }) {
    const { data, error } = await invokeEdgeFunction<{
      ok?: boolean;
      reason?: string;
      synced?: number;
      skipped?: number;
      snapshot_id?: number;
    }>("google_gsc/sync", {
      method: "POST",
      body: {
        monitored_website_id:
          params.monitoredWebsiteId != null
            ? Number(params.monitoredWebsiteId)
            : undefined,
        sync_all: params.syncAll ?? false,
      },
    });
    if (error) {
      throw new Error(
        await readEdgeFunctionErrorMessage(
          error,
          "Failed to sync Search Console",
        ),
      );
    }
    return {
      ok: Boolean(data?.ok),
      reason: data?.reason,
      synced: data?.synced,
      skipped: data?.skipped,
      snapshotId: data?.snapshot_id,
    };
  },
};
