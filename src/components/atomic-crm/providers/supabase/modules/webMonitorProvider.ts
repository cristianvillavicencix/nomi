import type { Identifier } from "ra-core";
import {
  invokeEdgeFunction,
  readEdgeFunctionErrorMessage,
} from "../invokeEdgeFunction";

export type WebsiteMonitorCheckResult = {
  ok?: boolean;
  ad_hoc?: boolean;
  url?: string;
  status?: "up" | "slow" | "down";
  responseMs?: number | null;
  httpStatus?: number | null;
  errorMessage?: string | null;
  sslExpiresAt?: string | null;
  sslDaysRemaining?: number | null;
  dnsIp?: string | null;
  dnsNameservers?: string[];
  dnsMx?: string[];
  hostingProvider?: string | null;
  hostingConfidence?: "low" | "medium" | "high" | null;
  techStack?: string[];
  pageTitle?: string | null;
  domainName?: string | null;
};

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
    const { data, error } = await invokeEdgeFunction<WebsiteMonitorCheckResult>(
      "website_monitor_check",
      {
        method: "POST",
        body: {
          monitored_website_id: Number(params.monitoredWebsiteId),
          include_deep_metadata: params.includeDeepMetadata ?? true,
        },
      },
    );
    if (error) {
      throw new Error(
        await readEdgeFunctionErrorMessage(error, "Failed to check website"),
      );
    }
    return data ?? ({ ok: true } as WebsiteMonitorCheckResult);
  },
  async websiteMonitorCheckAdHoc(params: {
    url: string;
    includeDeepMetadata?: boolean;
  }) {
    const { data, error } = await invokeEdgeFunction<WebsiteMonitorCheckResult>(
      "website_monitor_check",
      {
        method: "POST",
        body: {
          url: params.url,
          include_deep_metadata: params.includeDeepMetadata ?? true,
        },
      },
    );
    if (error) {
      throw new Error(
        await readEdgeFunctionErrorMessage(error, "Failed to check website"),
      );
    }
    return data ?? ({ ok: true } as WebsiteMonitorCheckResult);
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
