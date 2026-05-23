import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";

export const useDealsRealtime = (enabled = true) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel("deals_global")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deals" },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["deals"] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
};
