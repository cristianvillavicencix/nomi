import type { Identifier } from "ra-core";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import type { WebsiteAudit } from "@/lbs/website-monitor/audit/types";

export const fetchAuditHistory = async (siteId: Identifier) => {
  const { data, error } = await supabase
    .from("website_audits")
    .select("*")
    .eq("monitored_website_id", Number(siteId))
    .order("requested_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data ?? []) as WebsiteAudit[];
};

export const fetchPreviousDoneAudit = async (
  siteId: Identifier,
  currentAuditId: number,
) => {
  const { data, error } = await supabase
    .from("website_audits")
    .select("*")
    .eq("monitored_website_id", Number(siteId))
    .eq("status", "done")
    .neq("id", currentAuditId)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as WebsiteAudit | null) ?? null;
};

/** Delta vs the next newer done audit in history (chronological predecessor). */
export const deltaVsPreviousDone = (
  audits: WebsiteAudit[],
  index: number,
): number | null => {
  const current = audits[index];
  if (current?.status !== "done" || current.overall_score == null) {
    return null;
  }

  for (let i = index + 1; i < audits.length; i += 1) {
    const older = audits[i];
    if (older.status === "done" && older.overall_score != null) {
      return current.overall_score - older.overall_score;
    }
  }
  return null;
};
