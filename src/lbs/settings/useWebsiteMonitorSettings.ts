import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import {
  DEFAULT_WEBSITE_MONITOR_SETTINGS,
  parseWebsiteMonitorSettings,
  type WebsiteMonitorOrgSettings,
} from "@/lbs/website-monitor/websiteMonitorSettings";

export type OrganizationWebsiteMonitorRow = {
  id: number;
  website_monitor_settings: WebsiteMonitorOrgSettings;
};

export const useWebsiteMonitorSettings = (enabled = true) =>
  useQuery({
    queryKey: ["organization-website-monitor-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, website_monitor_settings")
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        throw new Error("Organization not found");
      }
      return {
        id: data.id as number,
        website_monitor_settings: parseWebsiteMonitorSettings(
          data.website_monitor_settings,
        ),
      } satisfies OrganizationWebsiteMonitorRow;
    },
    enabled,
    staleTime: 30_000,
  });

export const useWebsiteMonitorEnabled = () => {
  const { data, isPending } = useWebsiteMonitorSettings();
  return {
    isPending,
    enabled: data?.website_monitor_settings.enabled ?? true,
    settings: data?.website_monitor_settings ?? DEFAULT_WEBSITE_MONITOR_SETTINGS,
  };
};
