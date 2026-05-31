import type { Identifier } from "ra-core";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import type { GscSearchAnalyticsSnapshot } from "@/lbs/website-monitor/googleSearchConsoleTypes";

export const fetchLatestGscSnapshot = async (siteId: Identifier) => {
  const { data, error } = await supabase
    .from("gsc_search_analytics_snapshots")
    .select("*")
    .eq("monitored_website_id", Number(siteId))
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as GscSearchAnalyticsSnapshot | null) ?? null;
};
