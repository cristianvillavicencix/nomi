import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Identifier } from "ra-core";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";

/** Refresh deal_resources lists when files are added from the client wizard. */
export const useDealResourcesRealtime = (
  dealId: Identifier | null | undefined,
  enabled = true,
) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || dealId == null) return;

    const channel = supabase
      .channel(`deal_resources:${dealId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deal_resources",
          filter: `deal_id=eq.${dealId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["deal_resources"] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [dealId, enabled, queryClient]);
};
