import { createErrorResponse } from "./utils.ts";

export const getLbsIngestSecret = () =>
  Deno.env.get("LBS_INGEST_SECRET")?.trim() ?? "";

export const getLbsOrgId = (): number | null => {
  const raw = Deno.env.get("LBS_ORG_ID")?.trim() ?? "";
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const getLbsDefaultMemberId = (): number | null => {
  const raw = Deno.env.get("LBS_DEFAULT_MEMBER_ID")?.trim() ?? "";
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const verifyLbsIngestSecret = (req: Request): Response | null => {
  const expected = getLbsIngestSecret();
  if (!expected) {
    return createErrorResponse(
      503,
      "LBS_INGEST_SECRET is not configured on the server",
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
