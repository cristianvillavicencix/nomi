import { useQuery } from "@tanstack/react-query";
import { useGetIdentity } from "ra-core";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { hasMemberCapability } from "@/components/atomic-crm/providers/commons/memberModuleAccess";

export function useMailUnreadCount() {
  const { identity } = useGetIdentity();
  const canView =
    hasMemberCapability(identity as any, "mail.org.view") ||
    hasMemberCapability(identity as any, "mail.personal.view");

  return useQuery({
    queryKey: ["mail_unread_count", identity?.id],
    enabled: Boolean(identity?.id) && canView,
    refetchInterval: 60_000,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from("mail_threads")
        .select("id", { count: "exact", head: true })
        .eq("is_unread", true)
        .eq("is_trashed", false);
      if (error) throw error;
      return count ?? 0;
    },
  });
}
