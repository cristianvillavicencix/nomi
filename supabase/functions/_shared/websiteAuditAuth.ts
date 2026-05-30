import { createErrorResponse } from "./utils.ts";

export const getWebsiteAuditWorkerSecret = () =>
  Deno.env.get("WEB_AUDIT_WORKER_SECRET")?.trim() ?? "";

export const verifyWebsiteAuditWorkerSecret = (req: Request): Response | null => {
  const expected = getWebsiteAuditWorkerSecret();
  if (!expected) {
    return createErrorResponse(
      503,
      "WEB_AUDIT_WORKER_SECRET is not configured on the server",
    );
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!token || token !== expected) {
    return createErrorResponse(401, "Unauthorized");
  }

  return null;
};

export const getWebsiteAuditWorkerUrl = () =>
  Deno.env.get("WEB_AUDIT_WORKER_URL")?.trim().replace(/\/$/, "") ?? "";

export const getWebsiteAuditCallbackUrl = () => {
  const explicit = Deno.env.get("WEB_AUDIT_CALLBACK_URL")?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim().replace(/\/$/, "");
  if (!supabaseUrl) return "";
  return `${supabaseUrl}/functions/v1/website_audit_callback`;
};
