import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import type { MailLabel } from "./types";

export function useMailLabels(accountId: number | "all") {
  return useQuery({
    queryKey: ["mail_labels", accountId],
    queryFn: async (): Promise<MailLabel[]> => {
      let q = supabase.from("mail_labels").select("*").order("name").limit(200);
      if (accountId !== "all") q = q.eq("account_id", accountId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as MailLabel[];
    },
  });
}
