const parseIntEnv = (raw: string | undefined, fallback: number) => {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
};

export const config = {
  port: parseIntEnv(process.env.PORT, 8787),
  workerSecret: process.env.WEB_AUDIT_WORKER_SECRET?.trim() ?? "",
  workerId: process.env.WEB_AUDIT_WORKER_ID?.trim() ?? "web-audit-worker",
  timeoutMs: parseIntEnv(process.env.WEB_AUDIT_TIMEOUT_MS, 360_000),
  callbackMaxAttempts: parseIntEnv(process.env.WEB_AUDIT_CALLBACK_MAX_ATTEMPTS, 6),
  callbackInitialDelayMs: parseIntEnv(
    process.env.WEB_AUDIT_CALLBACK_INITIAL_DELAY_MS,
    1_000,
  ),
  chromePath: process.env.CHROME_PATH?.trim() || undefined,
  cruxApiKey: process.env.GOOGLE_CRUX_API_KEY?.trim() ?? "",
  userAgent:
    process.env.WEB_AUDIT_USER_AGENT?.trim() ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
};

export const assertConfig = () => {
  if (!config.workerSecret) {
    throw new Error("WEB_AUDIT_WORKER_SECRET is required");
  }
};
