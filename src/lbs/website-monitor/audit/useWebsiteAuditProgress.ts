import { useEffect, useState } from "react";
import type { WebsiteAudit } from "@/lbs/website-monitor/audit/types";
import { getAuditProgress } from "@/lbs/website-monitor/audit/websiteAuditProgress";

export const useWebsiteAuditProgress = (
  audit:
    | Pick<
        WebsiteAudit,
        "status" | "requested_at" | "started_at" | "progress_phase"
      >
    | null
    | undefined,
) => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!audit || (audit.status !== "queued" && audit.status !== "running")) {
      return;
    }

    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [audit]);

  if (!audit) {
    return null;
  }

  return getAuditProgress(audit, nowMs);
};
