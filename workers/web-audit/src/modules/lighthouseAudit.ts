import lighthouse from "lighthouse";
import type { LighthouseScores, WebsiteAuditStrategy } from "../types.js";
import { isBotBlockMessage } from "./staticAnalysis.js";
import type { AuditChrome } from "./sharedChrome.js";
import { killAuditChrome, launchAuditChrome } from "./sharedChrome.js";

export class LighthouseAuditError extends Error {
  constructor(
    message: string,
    readonly code: "bot_protection" | "timeout" | "lighthouse_failed",
  ) {
    super(message);
    this.name = "LighthouseAuditError";
  }
}

const roundScore = (value: number | undefined | null) =>
  Number.isFinite(value) ? Math.round(Number(value)) : null;

const extractMetric = (
  audits: Record<string, { numericValue?: number }> | undefined,
  id: string,
) => {
  const value = audits?.[id]?.numericValue;
  return Number.isFinite(value) ? Number(value) : null;
};

export const runLighthouseAudit = async (
  url: string,
  strategy: WebsiteAuditStrategy,
  signal: AbortSignal,
  sharedChrome?: AuditChrome,
): Promise<{ scores: LighthouseScores; chrome: AuditChrome }> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    if (sharedChrome && attempt > 1) {
      break;
    }
    try {
      return await runLighthouseAuditOnce(
        url,
        strategy,
        signal,
        attempt === 1 ? sharedChrome : undefined,
      );
    } catch (cause) {
      lastError = cause;
      const message = cause instanceof Error ? cause.message : String(cause);
      const retryable =
        attempt === 1 &&
        !sharedChrome &&
        !signal.aborted &&
        /protocol error|internal error|target closed|disconnected|session closed/i.test(
          message,
        );
      if (!retryable) {
        throw cause;
      }
      console.error(
        "web-audit lighthouse retry",
        strategy,
        attempt,
        message,
      );
    }
  }
  throw lastError;
};

const runLighthouseAuditOnce = async (
  url: string,
  strategy: WebsiteAuditStrategy,
  signal: AbortSignal,
  sharedChrome?: AuditChrome,
): Promise<{ scores: LighthouseScores; chrome: AuditChrome }> => {
  if (signal.aborted) {
    throw new LighthouseAuditError(
      "Lighthouse excedió el tiempo límite del audit.",
      "timeout",
    );
  }

  const ownsChrome = !sharedChrome;
  let chrome: AuditChrome | null = sharedChrome ?? null;

  try {
    chrome = chrome ?? (await launchAuditChrome());

    const formFactor = strategy === "desktop" ? "desktop" : "mobile";
    const runnerResult = await lighthouse(
      url,
      {
        logLevel: "error",
        output: "json",
        port: chrome.port,
        formFactor,
        screenEmulation:
          formFactor === "mobile" ? { mobile: true } : { mobile: false },
        onlyCategories: [
          "performance",
          "seo",
          "best-practices",
          "accessibility",
        ],
        maxWaitForLoad: 25_000,
        maxWaitForFcp: 15_000,
        skipAboutBlank: true,
      },
      undefined,
    );

    if (!runnerResult?.lhr) {
      throw new LighthouseAuditError(
        "Lighthouse no devolvió resultados.",
        "lighthouse_failed",
      );
    }

    const lhr = runnerResult.lhr;
    const categories = lhr.categories ?? {};
    const performance = roundScore(
      categories.performance?.score != null
        ? categories.performance.score * 100
        : null,
    );
    const seo = roundScore(
      categories.seo?.score != null ? categories.seo.score * 100 : null,
    );
    const bestPractices = roundScore(
      categories["best-practices"]?.score != null
        ? categories["best-practices"].score * 100
        : null,
    );
    const accessibility = roundScore(
      categories.accessibility?.score != null
        ? categories.accessibility.score * 100
        : null,
    );

    const scoresList = [performance, seo, bestPractices, accessibility].filter(
      (value): value is number => value != null,
    );
    const overall =
      scoresList.length > 0
        ? Math.round(
            scoresList.reduce((sum, value) => sum + value, 0) / scoresList.length,
          )
        : null;

    const audits = lhr.audits as Record<string, { numericValue?: number }>;

    const runtimeError = lhr.runtimeError?.message;
    if (runtimeError && isBotBlockMessage(runtimeError)) {
      throw new LighthouseAuditError(
        `Lighthouse no pudo cargar el sitio (${runtimeError}). Posible bot protection.`,
        "bot_protection",
      );
    }

    if (overall == null) {
      const finalUrl = lhr.finalDisplayedUrl ?? lhr.requestedUrl ?? url;
      throw new LighthouseAuditError(
        `Lighthouse no obtuvo scores para ${finalUrl}. El sitio puede bloquear Chrome headless.`,
        "lighthouse_failed",
      );
    }

    return {
      chrome,
      scores: {
        performance,
        seo,
        bestPractices,
        accessibility,
        overall,
        labLcpMs: extractMetric(audits, "largest-contentful-paint"),
        labFcpMs: extractMetric(audits, "first-contentful-paint"),
        labCls: extractMetric(audits, "cumulative-layout-shift"),
        labTbtMs: extractMetric(audits, "total-blocking-time"),
        lighthouseJson: lhr as unknown as Record<string, unknown>,
      },
    };
  } catch (cause) {
    if (cause instanceof LighthouseAuditError) {
      throw cause;
    }

    const message = cause instanceof Error ? cause.message : String(cause);

    if (signal.aborted) {
      throw new LighthouseAuditError(
        "Lighthouse excedió el tiempo límite del audit.",
        "timeout",
      );
    }

    if (isBotBlockMessage(message)) {
      throw new LighthouseAuditError(
        `Lighthouse bloqueado al cargar el sitio (${message}).`,
        "bot_protection",
      );
    }

    throw new LighthouseAuditError(
      `Lighthouse falló: ${message}`,
      "lighthouse_failed",
    );
  } finally {
    if (ownsChrome) {
      await killAuditChrome(chrome);
    }
  }
};
