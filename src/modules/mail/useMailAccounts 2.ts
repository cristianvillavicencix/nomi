import { useGetIdentity } from "ra-core";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { hasMemberCapability } from "@/components/atomic-crm/providers/commons/memberModuleAccess";
import type { MailAccount } from "./types";

export function useMailAccounts() {
  const { identity } = useGetIdentity();
  const canOrg = hasMemberCapability(identity as any, "mail.org.view");
  const canPersonal = hasMemberCapability(identity as any, "mail.personal.view");

  return useQuery({
    queryKey: ["mail_accounts_safe", identity?.id],
    enabled: Boolean(identity?.id) && (canOrg || canPersonal),
    queryFn: async (): Promise<MailAccount[]> => {
      const { data, error } = await supabase
        .from("mail_accounts_safe")
        .select("*")
        .order("email");
      if (error) throw error;
      return (data ?? []) as MailAccount[];
    },
  });
}
