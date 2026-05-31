import fs from "node:fs";
import type { WebsiteAuditWorkerJob } from "./types.js";

const ACTIVE_AUDIT_PATH =
  process.env.WEB_AUDIT_ACTIVE_FILE?.trim() || "/tmp/nomi-active-web-audit.json";

export const markActiveAudit = (job: WebsiteAuditWorkerJob) => {
  fs.writeFileSync(ACTIVE_AUDIT_PATH, JSON.stringify(job), "utf8");
};

export const clearActiveAudit = () => {
  try {
    fs.unlinkSync(ACTIVE_AUDIT_PATH);
  } catch {
    /* ignore */
  }
};

export const readActiveAudit = (): WebsiteAuditWorkerJob | null => {
  try {
    const raw = fs.readFileSync(ACTIVE_AUDIT_PATH, "utf8");
    const parsed = JSON.parse(raw) as WebsiteAuditWorkerJob;
    if (!parsed?.audit_id || !parsed.callback_url) return null;
    return parsed;
  } catch {
    return null;
  }
};
