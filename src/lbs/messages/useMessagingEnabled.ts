import { useQuery } from "@tanstack/react-query";
import { useDataProvider } from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";

export const useMessagingEnabled = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { data, isPending } = useQuery({
    queryKey: ["messaging-settings"],
    queryFn: () => dataProvider.getMessagingSettings(),
    staleTime: 60_000,
  });

  return {
    smsEnabled: data?.sms_enabled === true,
    isPending,
  };
};
