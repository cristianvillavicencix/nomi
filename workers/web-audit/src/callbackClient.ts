import type { WebsiteAuditCallbackPayload } from "./types.js";
import { config } from "./config.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const postCallback = async (
  callbackUrl: string,
  payload: WebsiteAuditCallbackPayload,
): Promise<void> => {
  let delayMs = config.callbackInitialDelayMs;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= config.callbackMaxAttempts; attempt += 1) {
    try {
      const response = await fetch(callbackUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.workerSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        return;
      }

      const body = await response.text().catch(() => "");
      lastError = new Error(
        `Callback HTTP ${response.status}: ${body.slice(0, 300)}`,
      );
    } catch (cause) {
      lastError =
        cause instanceof Error ? cause : new Error("Callback network error");
    }

    if (attempt < config.callbackMaxAttempts) {
      await sleep(delayMs);
      delayMs = Math.min(delayMs * 2, 30_000);
    }
  }

  throw lastError ?? new Error("Callback failed after retries");
};

export const postCallbackSafe = async (
  callbackUrl: string,
  payload: WebsiteAuditCallbackPayload,
) => {
  try {
    await postCallback(callbackUrl, payload);
  } catch (cause) {
    console.error("web-audit callback failed", payload.audit_id, cause);
  }
};
