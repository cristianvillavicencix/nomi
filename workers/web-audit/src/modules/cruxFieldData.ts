import { config } from "../config.js";
import type { WebsiteAuditStrategy } from "../types.js";

export type CruxDataLevel = "url" | "origin" | "none";

export type CruxFieldDataResult = {
  cruxHasData: boolean;
  cruxDataLevel: CruxDataLevel;
  fieldLcpMs: number | null;
  fieldCls: number | null;
  fieldInpMs: number | null;
  cruxJson: Record<string, unknown> | null;
};

type CruxFormFactor = "PHONE" | "DESKTOP";

type CruxMetric = {
  histogram?: Array<{ start: number; end?: number; density: number }>;
  percentiles?: { p75?: number | string };
};

type CruxQueryResponse = {
  record?: {
    key?: { url?: string; origin?: string; formFactor?: string };
    metrics?: Record<string, CruxMetric>;
  };
  error?: { code?: number; message?: string; status?: string };
};

const CRUX_API_URL =
  "https://chromeuxreport.googleapis.com/v1/records:queryRecord";

const formFactorForStrategy = (
  strategy: WebsiteAuditStrategy,
): CruxFormFactor => (strategy === "desktop" ? "DESKTOP" : "PHONE");

const parseOrigin = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    return parsed.origin;
  } catch {
    return null;
  }
};

const readMetricP75 = (
  metrics: Record<string, CruxMetric> | undefined,
  metricName: string,
): number | null => {
  const raw = metrics?.[metricName]?.percentiles?.p75;
  if (raw == null) return null;
  const value = typeof raw === "string" ? Number.parseFloat(raw) : raw;
  return Number.isFinite(value) ? value : null;
};

const extractFieldMetrics = (
  metrics: Record<string, CruxMetric> | undefined,
) => ({
  fieldLcpMs: readMetricP75(metrics, "largest_contentful_paint"),
  fieldCls: readMetricP75(metrics, "cumulative_layout_shift"),
  fieldInpMs: readMetricP75(metrics, "interaction_to_next_paint"),
});

const queryCrux = async (
  body: Record<string, unknown>,
  signal: AbortSignal,
): Promise<{ status: number; data: CruxQueryResponse | null; rateLimited: boolean }> => {
  if (!config.cruxApiKey) {
    return { status: 0, data: null, rateLimited: false };
  }

  const url = `${CRUX_API_URL}?key=${encodeURIComponent(config.cruxApiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (response.status === 429) {
    return { status: 429, data: null, rateLimited: true };
  }

  if (response.status === 404) {
    return { status: 404, data: null, rateLimited: false };
  }

  if (!response.ok) {
    let payload: CruxQueryResponse | null = null;
    try {
      payload = (await response.json()) as CruxQueryResponse;
    } catch {
      payload = null;
    }
    throw new Error(
      payload?.error?.message ??
        `CrUX API error ${response.status}`,
    );
  }

  const data = (await response.json()) as CruxQueryResponse;
  return { status: response.status, data, rateLimited: false };
};

const noDataResult = (
  cruxJson: Record<string, unknown> | null = null,
): CruxFieldDataResult => ({
  cruxHasData: false,
  cruxDataLevel: "none",
  fieldLcpMs: null,
  fieldCls: null,
  fieldInpMs: null,
  cruxJson,
});

/**
 * Fetches Chrome UX Report field data with url → origin cascade.
 * Non-fatal: 429 / missing API key / no data returns crux_has_data=false.
 */
export const fetchCruxFieldData = async (
  pageUrl: string,
  strategy: WebsiteAuditStrategy,
  signal: AbortSignal,
): Promise<CruxFieldDataResult> => {
  if (signal.aborted) {
    throw new Error("CrUX fetch aborted");
  }

  if (!config.cruxApiKey) {
    return noDataResult({ skipped: true, reason: "missing_api_key" });
  }

  const formFactor = formFactorForStrategy(strategy);
  const origin = parseOrigin(pageUrl);

  try {
    const urlAttempt = await queryCrux(
      { url: pageUrl, formFactor },
      signal,
    );

    if (urlAttempt.rateLimited) {
      return noDataResult({
        crux_data_level: "none",
        error: "rate_limited",
        status: 429,
      });
    }

    if (urlAttempt.data?.record?.metrics) {
      const metrics = urlAttempt.data.record.metrics;
      const fields = extractFieldMetrics(metrics);
      return {
        cruxHasData: true,
        cruxDataLevel: "url",
        ...fields,
        cruxJson: {
          crux_data_level: "url",
          formFactor,
          key: urlAttempt.data.record.key ?? { url: pageUrl },
          metrics,
        },
      };
    }

    if (!origin) {
      return noDataResult({
        crux_data_level: "none",
        url_attempt_status: urlAttempt.status,
      });
    }

    const originAttempt = await queryCrux({ origin, formFactor }, signal);

    if (originAttempt.rateLimited) {
      return noDataResult({
        crux_data_level: "none",
        error: "rate_limited",
        status: 429,
        url_attempt_status: urlAttempt.status,
      });
    }

    if (originAttempt.data?.record?.metrics) {
      const metrics = originAttempt.data.record.metrics;
      const fields = extractFieldMetrics(metrics);
      return {
        cruxHasData: true,
        cruxDataLevel: "origin",
        ...fields,
        cruxJson: {
          crux_data_level: "origin",
          formFactor,
          key: originAttempt.data.record.key ?? { origin },
          metrics,
          url_fallback_attempted: pageUrl,
        },
      };
    }

    return noDataResult({
      crux_data_level: "none",
      formFactor,
      url_attempt_status: urlAttempt.status,
      origin_attempt_status: originAttempt.status,
    });
  } catch (cause) {
    console.error("web-audit crux failed", cause);
    return noDataResult({
      crux_data_level: "none",
      error: cause instanceof Error ? cause.message : String(cause),
    });
  }
};
