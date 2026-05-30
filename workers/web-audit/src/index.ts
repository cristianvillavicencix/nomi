import http from "node:http";
import { config, assertConfig } from "./config.js";
import { runAuditJob } from "./runAudit.js";
import type { WebsiteAuditWorkerJob } from "./types.js";

const readJsonBody = async (req: http.IncomingMessage) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? (JSON.parse(raw) as unknown) : {};
};

const sendJson = (
  res: http.ServerResponse,
  status: number,
  body: Record<string, unknown>,
) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

const verifySecret = (req: http.IncomingMessage) => {
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";
  return token.length > 0 && token === config.workerSecret;
};

const parseJob = (body: unknown): WebsiteAuditWorkerJob | null => {
  if (!body || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;
  const auditId = Number(value.audit_id);
  const orgId = Number(value.org_id);
  const siteId = Number(value.monitored_website_id);
  const url = typeof value.url === "string" ? value.url.trim() : "";
  const callbackUrl =
    typeof value.callback_url === "string" ? value.callback_url.trim() : "";
  const strategyRaw = value.strategy;
  const strategy =
    strategyRaw === "desktop"
      ? "desktop"
      : strategyRaw === "mobile"
        ? "mobile"
        : "unified";

  if (
    !Number.isFinite(auditId) ||
    auditId <= 0 ||
    !Number.isFinite(orgId) ||
    orgId <= 0 ||
    !Number.isFinite(siteId) ||
    siteId <= 0 ||
    !url ||
    !callbackUrl
  ) {
    return null;
  }

  return {
    audit_id: auditId,
    org_id: orgId,
    monitored_website_id: siteId,
    url,
    strategy,
    callback_url: callbackUrl,
  };
};

/** In-flight audits — one job per audit_id at a time inside this process. */
const inFlight = new Set<number>();
const startedAt = Date.now();

const startServer = () => {
  assertConfig();

  const server = http.createServer(async (req, res) => {
    try {
      // Lightweight liveness only — no Chrome, no audit work (used to wake Fly).
      if (req.method === "GET" && (req.url === "/" || req.url === "")) {
        sendJson(res, 200, {
          ok: true,
          service: "nomi-web-audit-worker",
          docs: "API worker — use POST /audit (Bearer) or GET /health",
          health: "/health",
          note: "Los reportes se generan desde Nomi CRM (Web Monitor), no desde esta URL.",
        });
        return;
      }

      if (req.method === "GET" && req.url === "/health") {
        sendJson(res, 200, {
          ok: true,
          service: "web-audit-worker",
          uptime_s: Math.round((Date.now() - startedAt) / 1000),
          timeout_ms: config.timeoutMs,
        });
        return;
      }

      if (req.method === "POST" && req.url === "/audit") {
        if (!verifySecret(req)) {
          sendJson(res, 401, { ok: false, error: "Unauthorized" });
          return;
        }

        const body = await readJsonBody(req);
        const job = parseJob(body);
        if (!job) {
          sendJson(res, 400, { ok: false, error: "Invalid audit payload" });
          return;
        }

        if (inFlight.has(job.audit_id)) {
          sendJson(res, 202, {
            ok: true,
            accepted: true,
            duplicate: true,
            audit_id: job.audit_id,
          });
          return;
        }

        if (inFlight.size > 0) {
          sendJson(res, 503, {
            ok: false,
            error: "Worker busy processing another audit",
            retry: true,
          });
          return;
        }

        inFlight.add(job.audit_id);
        void runAuditJob(job)
          .catch((cause) => {
            console.error("web-audit unhandled", job.audit_id, cause);
          })
          .finally(() => {
            inFlight.delete(job.audit_id);
          });

        sendJson(res, 202, {
          ok: true,
          accepted: true,
          audit_id: job.audit_id,
        });
        return;
      }

      sendJson(res, 404, { ok: false, error: "Not found" });
    } catch (cause) {
      console.error("web-audit request error", cause);
      sendJson(res, 500, { ok: false, error: "Internal server error" });
    }
  });

  server.listen(config.port, () => {
    console.log(
      `web-audit-worker listening on :${config.port} (timeout ${config.timeoutMs}ms)`,
    );
  });
};

startServer();

/**
 * Pull-queue fallback (NOT implemented in Phase 1):
 * - Worker could poll Supabase RPC `claim_next_website_audit()` when PUSH fails.
 * - Documented for ops if WEB_AUDIT_WORKER_URL is unreachable from Edge.
 */
