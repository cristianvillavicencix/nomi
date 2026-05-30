import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import type { MonitoredWebsite } from "@/lbs/website-monitor/types";
import {
  patchMonitoredWebsiteInCache,
  scheduleMonitoredWebsitesSilentRefetch,
} from "@/lbs/website-monitor/websiteMonitorRealtimeCache";

type RealtimeRow = Partial<MonitoredWebsite> & {
  id?: number | string;
  is_enabled?: boolean;
};

export const useWebsiteMonitorRealtime = (enabled = true) => {
  const queryClient = useQueryClient();
  const debounceTimers = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel("monitored_websites_live")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "monitored_websites",
        },
        (payload) => {
          const row = payload.new as RealtimeRow | undefined;
          if (row?.id == null) return;

          patchMonitoredWebsiteInCache(queryClient, {
            id: row.id,
            last_status: row.last_status,
            last_response_ms: row.last_response_ms,
            last_http_status: row.last_http_status,
            last_checked_at: row.last_checked_at,
            last_error: row.last_error,
            hosting_provider: row.hosting_provider,
            tech_stack: row.tech_stack,
            page_title: row.page_title,
            ssl_days_remaining: row.ssl_days_remaining,
            is_enabled: row.is_enabled,
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "monitored_websites",
        },
        () => {
          scheduleMonitoredWebsitesSilentRefetch(
            queryClient,
            debounceTimers.current,
            "insert",
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "monitored_websites",
        },
        (payload) => {
          const row = payload.old as RealtimeRow | undefined;
          if (row?.id == null) return;
          patchMonitoredWebsiteInCache(queryClient, {
            id: row.id,
            is_enabled: false,
          });
        },
      )
      .subscribe();

    return () => {
      for (const timer of debounceTimers.current.values()) {
        clearTimeout(timer);
      }
      debounceTimers.current.clear();
      void supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
};
