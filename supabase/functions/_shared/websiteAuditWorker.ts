import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  getWebsiteAuditCallbackUrl,
  getWebsiteAuditWorkerSecret,
  getWebsiteAuditWorkerUrl,
} from "./websiteAuditAuth.ts";
import type { WebsiteAuditWorkerJob } from "./websiteAuditTypes.ts";

const ACTIVE_STATUSES = ["queued", "running"] as const;
const WORKER_HEALTH_TIMEOUT_MS = 8_000;
const WORKER_HEALTH_MAX_ATTEMPTS = 2;
const WORKER_PUSH_TIMEOUT_MS = 45_000;
export const WORKER_UNAVAILABLE = "Worker no disponible";

const normalizeWorkerBaseUrl = (workerUrl: string) =>
  workerUrl.trim().replace(/\/$/, "");

export const wakeWebsiteAuditWorker = async (workerUrl: string): Promise<void> => {
  const healthUrl = `${normalizeWorkerBaseUrl(workerUrl)}/health`;
  let lastError = "sin respuesta";

  for (let attempt = 1; attempt <= WORKER_HEALTH_MAX_ATTEMPTS; attempt += 1) {
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

export const pushAuditJobToWorker = async (
  job: WebsiteAuditWorkerJob,
): Promise<{ pushed: true }> => {
  const workerUrl = getWebsiteAuditWorkerUrl();
  const secret = getWebsiteAuditWorkerSecret();

  if (!workerUrl || !secret) {
    throw new Error(
      `${WORKER_UNAVAILABLE}: WEB_AUDIT_WORKER_URL o WEB_AUDIT_WORKER_SECRET no configurados.`,
    );
  }

  const baseUrl = normalizeWorkerBaseUrl(workerUrl);
  await wakeWebsiteAuditWorker(baseUrl);

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

  return { pushed: true };
};

export type EnqueueWebsiteAuditParams = {
  orgId: number;
  siteId: number;
  siteUrl: string;
  memberId?: number | null;
  scheduled?: boolean;
};

export type EnqueueWebsiteAuditResult =
  | { ok: true; reused: true; audit: Record<string, unknown> }
  | {
    ok: true;
    reused: false;
    audit: Record<string, unknown>;
    worker: { pushed: true } | { pushed: false; error: string };
  };

export const enqueueWebsiteAudit = async (
  supabase: SupabaseClient,
  params: EnqueueWebsiteAuditParams,
): Promise<EnqueueWebsiteAuditResult> => {
  const { orgId, siteId, siteUrl, memberId, scheduled = false } = params;

  const { data: existingActive, error: activeError } = await supabase
    .from("website_audits")
    .select("*")
    .eq("monitored_website_id", siteId)
    .in("status", [...ACTIVE_STATUSES])
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeError) {
    throw new Error(activeError.message);
  }

  if (existingActive) {
    return { ok: true, reused: true, audit: existingActive };
  }

  const callbackUrl = getWebsiteAuditCallbackUrl();
  if (!callbackUrl) {
    throw new Error("WEB_AUDIT_CALLBACK_URL or SUPABASE_URL is not configured");
  }

  const { data: created, error: insertError } = await supabase
    .from("website_audits")
    .insert({
      org_id: orgId,
      monitored_website_id: siteId,
      requested_by_member_id: memberId ?? null,
      status: "queued",
      audit_url: siteUrl,
      strategy: "unified",
      scheduled,
    })
    .select("*")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: raced } = await supabase
        .from("website_audits")
        .select("*")
        .eq("monitored_website_id", siteId)
        .in("status", [...ACTIVE_STATUSES])
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (raced) {
        return { ok: true, reused: true, audit: raced };
      }
    }
    throw new Error(insertError.message);
  }

  const job: WebsiteAuditWorkerJob = {
    audit_id: created.id,
    org_id: orgId,
    monitored_website_id: siteId,
    url: siteUrl,
    strategy: "unified",
    callback_url: callbackUrl,
  };

  try {
    await pushAuditJobToWorker(job);
    await supabase
      .from("website_audits")
      .update({
        last_worker_push_at: new Date().toISOString(),
        worker_push_attempts: (created.worker_push_attempts ?? 0) + 1,
        error_message: null,
      })
      .eq("id", created.id);

    return {
      ok: true,
      reused: false,
      audit: created,
      worker: { pushed: true },
    };
  } catch (cause) {
    const rawMessage =
      cause instanceof Error ? cause.message : "Worker push failed";
    const errorMessage = rawMessage.startsWith(WORKER_UNAVAILABLE)
      ? rawMessage
      : `${WORKER_UNAVAILABLE}: ${rawMessage}`;

    await supabase
      .from("website_audits")
      .update({
        last_worker_push_at: new Date().toISOString(),
        worker_push_attempts: (created.worker_push_attempts ?? 0) + 1,
        error_message: errorMessage,
      })
      .eq("id", created.id);

    const { data: queuedAudit } = await supabase
      .from("website_audits")
      .select("*")
      .eq("id", created.id)
      .maybeSingle();

    return {
      ok: true,
      reused: false,
      audit: queuedAudit ?? created,
      worker: { pushed: false, error: errorMessage },
    };
  }
};

export const retryQueuedAuditPush = async (
  supabase: SupabaseClient,
  audit: {
    id: number;
    org_id: number;
    monitored_website_id: number;
    audit_url: string;
    worker_push_attempts?: number | null;
  },
): Promise<{ pushed: boolean; error?: string }> => {
  const callbackUrl = getWebsiteAuditCallbackUrl();
  if (!callbackUrl) {
    return { pushed: false, error: "callback_url_missing" };
  }

  const job: WebsiteAuditWorkerJob = {
    audit_id: audit.id,
    org_id: audit.org_id,
    monitored_website_id: audit.monitored_website_id,
    url: audit.audit_url,
    strategy: "unified",
    callback_url: callbackUrl,
  };

  try {
    await pushAuditJobToWorker(job);
    await supabase
      .from("website_audits")
      .update({
        last_worker_push_at: new Date().toISOString(),
        worker_push_attempts: (audit.worker_push_attempts ?? 0) + 1,
        error_message: null,
      })
      .eq("id", audit.id)
      .eq("status", "queued");

    return { pushed: true };
  } catch (cause) {
    const rawMessage =
      cause instanceof Error ? cause.message : "Worker push failed";
    const errorMessage = rawMessage.startsWith(WORKER_UNAVAILABLE)
      ? rawMessage
      : `${WORKER_UNAVAILABLE}: ${rawMessage}`;

    await supabase
      .from("website_audits")
      .update({
        last_worker_push_at: new Date().toISOString(),
        worker_push_attempts: (audit.worker_push_attempts ?? 0) + 1,
        error_message: errorMessage,
      })
      .eq("id", audit.id)
      .eq("status", "queued");

    return { pushed: false, error: errorMessage };
  }
};
